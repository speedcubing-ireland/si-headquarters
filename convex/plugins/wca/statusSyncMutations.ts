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
import { reachedMilestones } from "@/convex/plugins/wca/competitionStatus"
import {
  wcaCompetitionStatusValidator,
  type WcaCompetitionStatus,
} from "@/convex/plugins/wca/validators"

/**
 * Competitions can grow without bound, so the sync reads a bounded page and
 * shouts rather than silently syncing a subset.
 */
const MAX_LINKED_COMPETITIONS = 500

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

export const listLinkedWcaCompetitionIds = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const competitions = await ctx.db
      .query("competitions")
      .withIndex("by_wcaCompetitionId")
      .take(MAX_LINKED_COMPETITIONS + 1)

    if (competitions.length > MAX_LINKED_COMPETITIONS) {
      throw new Error("Too many competitions to sync WCA status for at once.")
    }

    return competitions
      .map((competition) => competition.wcaCompetitionId)
      .filter((id): id is string => id !== undefined && id.length > 0)
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
    status: wcaCompetitionStatusValidator,
    templateKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { status } = args

    await upsertStatusSnapshot(ctx, status)

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
    })

    return null
  },
})

async function upsertStatusSnapshot(
  ctx: MutationCtx,
  status: WcaCompetitionStatus
): Promise<void> {
  const existing = await ctx.db
    .query("wcaCompetitionStatuses")
    .withIndex("by_wcaCompetitionId", (q) =>
      q.eq("wcaCompetitionId", status.wcaCompetitionId)
    )
    .unique()

  if (existing === null) {
    await ctx.db.insert("wcaCompetitionStatuses", status)
    return
  }
  await ctx.db.replace("wcaCompetitionStatuses", existing._id, status)
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
