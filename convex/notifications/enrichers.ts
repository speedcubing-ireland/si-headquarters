import type { Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import type { NotificationDraft } from "@/convex/notifications/validators"
import { BACKEND_PLUGINS } from "@/convex/plugins/registry"

const MAX_TASK_INTEGRATIONS = 20

type ReadCtx = Pick<QueryCtx, "db">

const taskEnrichers = BACKEND_PLUGINS.flatMap((plugin) =>
  plugin.enrichTaskNotification === undefined
    ? []
    : [plugin.enrichTaskNotification]
)

export async function enrichTaskNotificationDraft(
  ctx: ReadCtx,
  draft: NotificationDraft,
  taskId: Id<"tasks">
): Promise<NotificationDraft> {
  if (taskEnrichers.length === 0) return draft
  const integrations = await ctx.db
    .query("taskIntegrations")
    .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
    .take(MAX_TASK_INTEGRATIONS)

  return taskEnrichers.reduce(
    (current, enrich) => enrich({ draft: current, taskId, integrations }),
    draft
  )
}
