import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "@/convex/_generated/server"
import { scheduleNotificationEvent } from "@/convex/notifications/events"
import { listPhasesForOwnerBounded } from "@/convex/phases/model"
import {
  ownerPhaseId,
  setCurrentPhaseForOwner,
} from "@/convex/phases/setCurrentPhase"
import { loadMappingsForTemplate } from "@/convex/phases/wcaMappingModel"
import { resolveWcaPhaseAdvance } from "@/convex/phases/wcaAdvance"
import {
  mergeObservation,
  reachedMilestones,
} from "@/convex/plugins/wca/competitionStatus"
import {
  wcaCompetitionObservationValidator,
  type WcaCompetitionObservation,
  type WcaCompetitionStatus,
} from "@/convex/plugins/wca/validators"

/** Linked competitions read per page; the caller pages until done. */
const LINKED_COMPETITIONS_PAGE_SIZE = 200

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
    templateKey: v.string(),
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

    await reconcileCancellation(ctx, competition._id, status)

    const owner = { type: "competitions", id: competition._id } as const
    const [phases, mappings] = await Promise.all([
      listPhasesForOwnerBounded(ctx, owner),
      loadMappingsForTemplate(ctx, args.templateKey),
    ])

    const previousPhaseId = ownerPhaseId(competition)
    const nextPhaseId = resolveWcaPhaseAdvance({
      phases,
      currentPhaseId: previousPhaseId,
      mappings,
      reached: reachedMilestones(status, status.fetchedAt),
    })

    if (nextPhaseId === null) return null

    await setCurrentPhaseForOwner(ctx, {
      owner,
      phaseId: nextPhaseId,
      // System-driven: no human moved this.
      actorId: null,
      previousPhaseId,
      // A sync can jump several phases at once (a competition linked late may
      // go straight to Completed). Nobody is watching, so the phases it passed
      // through must not leave their tasks stranded in backlog.
      activateSkippedPhases: true,
    })

    return null
  },
})

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
  competitionId: Id<"competitions">,
  status: WcaCompetitionStatus
): Promise<void> {
  const competition = await ctx.db.get("competitions", competitionId)
  if (competition === null) return

  const wasCancelled = competition.cancelledAt !== undefined
  if (wasCancelled === status.cancelled) return

  await ctx.db.patch("competitions", competitionId, {
    cancelledAt: status.cancelled ? status.fetchedAt : undefined,
  })

  await scheduleNotificationEvent(ctx, {
    kind: "competitionCancelled",
    competitionId,
    cancelled: status.cancelled,
  })
}
