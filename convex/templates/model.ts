import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import { listPhasesForOwner } from "@/convex/phases/model"

type DbCtx = Pick<QueryCtx | MutationCtx, "db">

export async function getCompetitionTemplateApplicationBlockReason(
  ctx: DbCtx,
  competitionId: Id<"competitions">
): Promise<string | null> {
  const phases = await listPhasesForOwner(ctx, {
    type: "competitions",
    id: competitionId,
  })
  if (phases.length > 0) {
    return "Remove all phases before applying a template."
  }

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_root_type_and_root_id", (q) =>
      q.eq("root.type", "competitions").eq("root.id", competitionId)
    )
    .take(1)
  if (tasks.length > 0) {
    return "Remove all tasks before applying a template."
  }

  return null
}
