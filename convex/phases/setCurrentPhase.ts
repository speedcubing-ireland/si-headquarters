import { ConvexError } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import type { CompetitionOrProjectRef } from "@/convex/utils"
import {
  scheduleNotificationEvent,
  scheduleTaskStatusNotifications,
} from "@/convex/notifications/events"
import { activatePhasesBacklogTasks } from "@/convex/tasks/status/recompute"
import { listPhasesForOwnerBounded } from "@/convex/phases/model"

export async function setCurrentPhaseForOwner(
  ctx: MutationCtx,
  args: {
    owner: CompetitionOrProjectRef
    phaseId: Id<"phases">
    /** Null when the change is system-driven, e.g. the WCA status sync. */
    actorId: Id<"users"> | null
    previousPhaseId: Id<"phases"> | null
    /**
     * Also activate the backlog of any phase jumped over, not just the target.
     *
     * Off by default so a human moving the phase in the UI keeps the existing
     * behaviour — they can see what they skipped. The WCA sync turns it on:
     * it can advance several phases at once and nobody is watching, so
     * otherwise those phases' tasks would sit in backlog, filtered out of
     * every dashboard view, indefinitely.
     */
    activateSkippedPhases?: boolean
  }
): Promise<void> {
  const phase = await ctx.db.get("phases", args.phaseId)
  if (phase === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Phase not found",
    })
  }
  if (
    phase.owner.type !== args.owner.type ||
    phase.owner.id !== args.owner.id
  ) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: `Phase not found for ${args.owner.type === "projects" ? "project" : "competition"}`,
    })
  }

  if (args.previousPhaseId === args.phaseId) {
    return
  }

  const table = args.owner.type
  await ctx.db.patch(table, args.owner.id, { phaseId: args.phaseId })

  await scheduleNotificationEvent(ctx, {
    kind: "phaseChanged",
    object: args.owner,
    actorId: args.actorId,
    previousPhaseId: args.previousPhaseId,
    nextPhaseId: args.phaseId,
  })

  const phaseIds =
    args.activateSkippedPhases === true
      ? await phasesEnteredBy(ctx, {
          owner: args.owner,
          previousPhaseId: args.previousPhaseId,
          targetPhase: phase,
        })
      : [args.phaseId]

  const result = await activatePhasesBacklogTasks(ctx, phaseIds)
  await scheduleTaskStatusNotifications(ctx, result, args.actorId)
}

/**
 * Every phase from just after the previous one through the target, in phase
 * order — the phases this move passes into. Falls back to the target alone if
 * the previous phase isn't one of the owner's rows.
 */
async function phasesEnteredBy(
  ctx: MutationCtx,
  args: {
    owner: CompetitionOrProjectRef
    previousPhaseId: Id<"phases"> | null
    targetPhase: Doc<"phases">
  }
): Promise<Id<"phases">[]> {
  const phases = await listPhasesForOwnerBounded(ctx, args.owner)

  const previousSortKey =
    args.previousPhaseId === null
      ? null
      : (phases.find((phase) => phase._id === args.previousPhaseId)?.sortKey ??
        null)

  const entered = phases.filter(
    (phase) =>
      phase.sortKey <= args.targetPhase.sortKey &&
      (previousSortKey === null || phase.sortKey > previousSortKey)
  )

  return entered.length > 0
    ? entered.map((phase) => phase._id)
    : [args.targetPhase._id]
}

export function ownerPhaseId(
  doc: Doc<"competitions"> | Doc<"projects">
): Id<"phases"> | null {
  return doc.phaseId
}
