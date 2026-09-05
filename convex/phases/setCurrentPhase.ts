import { ConvexError } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import type { CompetitionOrProjectRef } from "@/convex/utils"
import {
  scheduleNotificationEvent,
  scheduleTaskStatusNotifications,
} from "@/convex/notifications/events"
import { activatePhaseBacklogTasks } from "@/convex/tasks/status/recompute"

export async function setCurrentPhaseForOwner(
  ctx: MutationCtx,
  args: {
    owner: CompetitionOrProjectRef
    phaseId: Id<"phases">
    /** Null when the change is system-driven, e.g. the WCA status sync. */
    actorId: Id<"users"> | null
    previousPhaseId: Id<"phases"> | null
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

  const result = await activatePhaseBacklogTasks(ctx, args.phaseId)
  await scheduleTaskStatusNotifications(ctx, result, args.actorId)
}

export function ownerPhaseId(
  doc: Doc<"competitions"> | Doc<"projects">
): Id<"phases"> | null {
  return doc.phaseId
}
