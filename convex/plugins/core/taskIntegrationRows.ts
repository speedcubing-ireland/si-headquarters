import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import type { TaskIntegrationId } from "@/convex/plugins/core/validators"

export async function insertTaskIntegrationIfMissing(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  integrationId: TaskIntegrationId
): Promise<Id<"taskIntegrations">> {
  const existing = await ctx.db
    .query("taskIntegrations")
    .withIndex("by_taskId_and_integrationId", (q) =>
      q.eq("taskId", taskId).eq("integrationId", integrationId)
    )
    .unique()

  if (existing !== null) {
    return existing._id
  }

  return await ctx.db.insert("taskIntegrations", {
    taskId,
    integrationId,
    status: "idle",
    lastMessage: null,
    lastRunAt: null,
    runId: null,
    output: null,
  })
}
