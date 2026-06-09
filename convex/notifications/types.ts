import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { NotificationDraft } from "@/convex/notifications/validators"

export interface TaskNotificationEnrichmentInput {
  draft: NotificationDraft
  taskId: Id<"tasks">
  integrations: readonly Doc<"taskIntegrations">[]
}

export type TaskNotificationEnricher = (
  input: TaskNotificationEnrichmentInput
) => NotificationDraft
