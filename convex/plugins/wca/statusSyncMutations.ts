import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "@/convex/_generated/server"
import { isCompetitionCancelled } from "@/convex/competitions/lifecycle"
import { scheduleNotificationEvent } from "@/convex/notifications/events"
import { listPhasesForOwnerBounded } from "@/convex/phases/model"
import {
  ownerPhaseId,
  setCurrentPhaseForOwner,
} from "@/convex/phases/setCurrentPhase"
import { resolveBlockedPhaseIds } from "@/convex/phases/entryGates"
import { loadMappings } from "@/convex/phases/wcaMappingModel"
import { wcaPhaseMappingEntry } from "@/convex/phases/validators"
import { resolveWcaPhaseAdvance } from "@/convex/phases/wcaAdvance"
import {
  isHeldBy,
  mergeObservation,
  pickRenameCandidate,
  reachedMilestones,
} from "@/convex/plugins/wca/competitionStatus"
import { clearLinkIssues } from "@/convex/plugins/wca/linkIssues"
import {
  wcaCompetitionObservationValidator,
  wcaRenameOptionValidator,
  type WcaCompetitionObservation,
  type WcaCompetitionStatus,
  type WcaRenameCandidate,
} from "@/convex/plugins/wca/validators"

/** Linked competitions read per page; the caller pages until done. */
const LINKED_COMPETITIONS_PAGE_SIZE = 200

/**
 * HQ competitions read per WCA id. One WCA competition should be linked to one
 * HQ competition; the bound only keeps a duplicate link from being unbounded.
 */
const MAX_COMPETITIONS_PER_WCA_ID = 10

/**
 * Cron entry point. Crons in this codebase target internal mutations, and the
 * fetching has to happen in an action, so this just queues one.
 */
export const queueStatusSync = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(
      0,
      internal.plugins.wca.statusSync.syncCompetitionStatuses,
      {}
    )
    return null
  },
})

/**
 * The org-level mapping, resolved once per sync run — it is identical for every
 * competition, so the per-competition transactions take it as an argument
 * rather than each re-reading the same row.
 */
export const getPhaseMappings = internalQuery({
  args: {},
  returns: v.array(wcaPhaseMappingEntry),
  handler: async (ctx) => await loadMappings(ctx),
})

/**
 * Refund deadlines we already know, so the run can skip a detail request for a
 * competition whose refund window has demonstrably shut. Resolved once per run
 * like the mapping above: one indexed read beats one HTTP request per
 * competition per hour for the weeks between the refund window closing and the
 * competition being held.
 */
export const getStoredRefundDeadlines = internalQuery({
  args: { wcaCompetitionIds: v.array(v.string()) },
  returns: v.array(
    v.object({
      wcaCompetitionId: v.string(),
      refundDeadlineAt: v.union(v.number(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const deadlines = []
    for (const wcaCompetitionId of args.wcaCompetitionIds) {
      const status = await ctx.db
        .query("wcaCompetitionStatuses")
        .withIndex("by_wcaCompetitionId", (q) =>
          q.eq("wcaCompetitionId", wcaCompetitionId)
        )
        .unique()
      deadlines.push({
        wcaCompetitionId,
        refundDeadlineAt: status?.refundDeadlineAt ?? null,
      })
    }
    return deadlines
  },
})

export const getLinkedWcaCompetitionId = internalQuery({
  args: { competitionId: v.id("competitions") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const competition = await ctx.db.get("competitions", args.competitionId)
    const wcaCompetitionId = competition?.wcaCompetitionId
    if (wcaCompetitionId === undefined || wcaCompetitionId.length === 0) {
      return null
    }
    return wcaCompetitionId
  },
})

/**
 * One page of the competitions that are linked to the WCA.
 *
 * The index range matters: unlinked competitions have no `wcaCompetitionId`,
 * and a missing field sorts before every string in Convex index order, so an
 * unranged scan would spend its budget on unlinked rows and might never reach
 * a linked one. `gt("")` skips both the missing field and the empty string.
 */
export const listLinkedWcaCompetitionIds = internalQuery({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    ids: v.array(v.string()),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("competitions")
      .withIndex("by_wcaCompetitionId", (q) => q.gt("wcaCompetitionId", ""))
      .paginate({
        numItems: LINKED_COMPETITIONS_PAGE_SIZE,
        cursor: args.cursor ?? null,
      })

    return {
      ids: page.page
        .map((competition) => competition.wcaCompetitionId)
        .filter((id): id is string => id !== undefined && id.length > 0),
      cursor: page.continueCursor,
      isDone: page.isDone,
    }
  },
})

/**
 * Applies one WCA status: stores the snapshot, reconciles `cancelledAt`, and
 * advances the phase when the milestones reached unlock a later one.
 *
 * Deliberately one competition per transaction, so a competition whose phases
 * are in an odd state cannot stop the rest of the run.
 */
export const applyCompetitionStatus = internalMutation({
  args: {
    observation: wcaCompetitionObservationValidator,
    /** Resolved once per run by the caller; identical for every competition. */
    mappings: v.array(wcaPhaseMappingEntry),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Merge here rather than in the action: this transaction already reads the
    // stored row, so there is no window for a concurrent sync to interleave
    // between the read and the write.
    const status = await upsertStatusSnapshot(ctx, args.observation)

    const competition = await ctx.db
      .query("competitions")
      .withIndex("by_wcaCompetitionId", (q) =>
        q.eq("wcaCompetitionId", status.wcaCompetitionId)
      )
      .first()

    if (competition === null) return null

    // The WCA has the competition, so whatever broke the link is fixed.
    await clearLinkIssues(ctx, competition._id)
    await reconcileCancellation(ctx, competition, status)

    const owner = { type: "competitions", id: competition._id } as const
    const phases = await listPhasesForOwnerBounded(ctx, owner)

    const previousPhaseId = ownerPhaseId(competition)
    // Resolved per competition rather than per run: unlike the mapping, this
    // depends on the competition's own tasks.
    const blockedPhaseIds = await resolveBlockedPhaseIds(
      ctx,
      phases,
      previousPhaseId
    )
    const nextPhaseId = resolveWcaPhaseAdvance({
      phases,
      currentPhaseId: previousPhaseId,
      mappings: args.mappings,
      reached: reachedMilestones(status, status.fetchedAt),
      blockedPhaseIds,
    })

    if (nextPhaseId === null) return null

    await setCurrentPhaseForOwner(ctx, {
      owner,
      phaseId: nextPhaseId,
      // System-driven, so this also activates the phases it passes through.
      actorId: null,
      previousPhaseId,
      phases,
    })

    return null
  },
})

function listCompetitionsLinkedTo(
  ctx: QueryCtx,
  wcaCompetitionId: string
): Promise<Doc<"competitions">[]> {
  return ctx.db
    .query("competitions")
    .withIndex("by_wcaCompetitionId", (q) =>
      q.eq("wcaCompetitionId", wcaCompetitionId)
    )
    .take(MAX_COMPETITIONS_PER_WCA_ID)
}

async function getStoredStatus(
  ctx: QueryCtx,
  wcaCompetitionId: string
): Promise<Doc<"wcaCompetitionStatuses"> | null> {
  return await ctx.db
    .query("wcaCompetitionStatuses")
    .withIndex("by_wcaCompetitionId", (q) =>
      q.eq("wcaCompetitionId", wcaCompetitionId)
    )
    .unique()
}

/**
 * The competition's dates: HQ's own first, then the last dates the WCA gave us.
 * Either can be missing, and HQ is what people edit, so it wins.
 */
function competitionDates(
  competition: Doc<"competitions">,
  status: Doc<"wcaCompetitionStatuses"> | null
): { startDate: string | null; endDate: string | null } {
  return {
    startDate: competition.compDates.from ?? status?.startDate ?? null,
    endDate: competition.compDates.to ?? status?.endDate ?? null,
  }
}

/**
 * Which of these WCA ids belong to a competition that has not been held yet.
 * Only those are worth checking on the WCA: a past competition with a dead
 * link has nothing left for the sync to do.
 */
export const listUpcomingLinkedIds = internalQuery({
  args: { wcaCompetitionIds: v.array(v.string()), nowMs: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const upcoming: string[] = []
    for (const wcaCompetitionId of args.wcaCompetitionIds) {
      const [competitions, status] = await Promise.all([
        listCompetitionsLinkedTo(ctx, wcaCompetitionId),
        getStoredStatus(ctx, wcaCompetitionId),
      ])
      const hasUpcoming = competitions.some(
        (competition) =>
          !isHeldBy(competitionDates(competition, status).endDate, args.nowMs)
      )
      if (hasUpcoming) upcoming.push(wcaCompetitionId)
    }
    return upcoming
  },
})

/**
 * Records that the WCA answered 404 for a linked id, so the competition page
 * can show it and the competition's Discord channel hears about it once.
 *
 * `options` are the upcoming competitions the WCA account manages. The rename
 * candidate is picked here rather than in the action because only the database
 * knows which of them HQ has already linked.
 */
export const recordMissingWcaCompetition = internalMutation({
  args: {
    wcaCompetitionId: v.string(),
    options: v.array(wcaRenameOptionValidator),
    detectedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [competitions, status] = await Promise.all([
      listCompetitionsLinkedTo(ctx, args.wcaCompetitionId),
      getStoredStatus(ctx, args.wcaCompetitionId),
    ])
    if (competitions.length === 0) return null

    const linkedOptionIds = new Set<string>()
    for (const option of args.options) {
      const linked = await ctx.db
        .query("competitions")
        .withIndex("by_wcaCompetitionId", (q) =>
          q.eq("wcaCompetitionId", option.id)
        )
        .first()
      if (linked !== null) linkedOptionIds.add(option.id)
    }

    for (const competition of competitions) {
      const dates = competitionDates(competition, status)
      if (isHeldBy(dates.endDate, args.detectedAt)) continue
      const renameCandidate = pickRenameCandidate({
        ...dates,
        options: args.options,
        isLinked: (id) => linkedOptionIds.has(id),
      })
      await upsertLinkIssue(ctx, {
        competition,
        renameCandidate,
        detectedAt: args.detectedAt,
      })
    }
    return null
  },
})

/**
 * Creates or refreshes the competition's issue. The notification goes out only
 * when the issue is new, so a link that stays broken is reported once rather
 * than every hour.
 */
async function upsertLinkIssue(
  ctx: MutationCtx,
  input: {
    competition: Doc<"competitions">
    renameCandidate: WcaRenameCandidate | null
    detectedAt: number
  }
): Promise<void> {
  const { competition, renameCandidate } = input
  const wcaCompetitionId = competition.wcaCompetitionId
  if (wcaCompetitionId === undefined) return

  const existing = await ctx.db
    .query("wcaLinkIssues")
    .withIndex("by_competitionId", (q) =>
      q.eq("competitionId", competition._id)
    )
    .take(MAX_COMPETITIONS_PER_WCA_ID)
  const current = existing.find(
    (issue) => issue.wcaCompetitionId === wcaCompetitionId
  )

  if (current !== undefined) {
    if (!sameCandidate(current.renameCandidate, renameCandidate)) {
      await ctx.db.patch("wcaLinkIssues", current._id, { renameCandidate })
    }
    return
  }

  // Rows for an id the competition is no longer linked to are stale.
  await clearLinkIssues(ctx, competition._id)
  await ctx.db.insert("wcaLinkIssues", {
    competitionId: competition._id,
    wcaCompetitionId,
    detectedAt: input.detectedAt,
    renameCandidate,
  })
  await scheduleNotificationEvent(ctx, {
    kind: "wcaLinkBroken",
    competitionId: competition._id,
    wcaCompetitionId,
    renameCandidate,
  })
}

function sameCandidate(
  a: WcaRenameCandidate | null,
  b: WcaRenameCandidate | null
): boolean {
  if (a === null || b === null) return a === b
  return a.id === b.id && a.name === b.name && a.url === b.url
}

/** Folds the observation onto the stored row and returns the merged status. */
async function upsertStatusSnapshot(
  ctx: MutationCtx,
  observation: WcaCompetitionObservation
): Promise<WcaCompetitionStatus> {
  const existing = await ctx.db
    .query("wcaCompetitionStatuses")
    .withIndex("by_wcaCompetitionId", (q) =>
      q.eq("wcaCompetitionId", observation.wcaCompetitionId)
    )
    .unique()

  const status = mergeObservation(existing, observation)

  if (existing === null) {
    await ctx.db.insert("wcaCompetitionStatuses", status)
  } else {
    await ctx.db.replace("wcaCompetitionStatuses", existing._id, status)
  }
  return status
}

/**
 * Cancellation is orthogonal to the phase — a cancelled competition keeps
 * whatever phase it reached — so this only touches `cancelledAt`, and only when
 * the flag actually changed, to avoid re-notifying on every sync.
 */
async function reconcileCancellation(
  ctx: MutationCtx,
  competition: Doc<"competitions">,
  status: WcaCompetitionStatus
): Promise<void> {
  if (isCompetitionCancelled(competition) === status.cancelled) return

  await ctx.db.patch("competitions", competition._id, {
    cancelledAt: status.cancelled ? status.fetchedAt : undefined,
  })

  await scheduleNotificationEvent(ctx, {
    kind: "competitionCancelled",
    competitionId: competition._id,
    cancelled: status.cancelled,
  })
}
