import { v, type Infer } from "convex/values"

export const OPEN_TASK_STATUSES = ["backlog", "to-do", "in-progress"] as const

export const COMPLETION_TASK_STATUSES = [
  "awaiting-review",
  "done",
  "cancelled",
] as const

export const TASK_STATUSES = [
  ...OPEN_TASK_STATUSES,
  ...COMPLETION_TASK_STATUSES,
] as const

export const TASK_STATUS_COMMANDS = [...TASK_STATUSES, "auto"] as const

export const taskStatusType = v.union(
  ...TASK_STATUSES.map((status) => v.literal(status))
)

export const taskStatusCommandType = v.union(
  ...TASK_STATUS_COMMANDS.map((status) => v.literal(status))
)

export const taskStatusIntentType = v.union(
  v.object({
    type: v.literal("manual"),
    status: taskStatusType,
  }),
  v.object({
    type: v.literal("auto"),
  })
)

export type TaskStatus = Infer<typeof taskStatusType>
export type TaskStatusCommand = Infer<typeof taskStatusCommandType>
export type TaskStatusIntent = Infer<typeof taskStatusIntentType>
