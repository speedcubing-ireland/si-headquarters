import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { TaskStatusView } from "@/convex/tasks/status/resolver"
import { taskViewTaskDetails } from "@/convex/tasks/view"
import { v, type Infer } from "convex/values"

export const taskInlinePath = v.object({
  taskTitle: v.string(),
  subtaskTitle: v.string(),
  subtaskIndicator: v.union(v.string(), v.null()),
  taskTitleId: v.id("tasks"),
  subtaskTitleId: v.union(v.id("tasks"), v.null()),
})

export const taskInlineRow = v.object({
  ...taskViewTaskDetails.fields,
  path: taskInlinePath,
})

export type TaskInlinePath = Infer<typeof taskInlinePath>
export type TaskInlineRow = Infer<typeof taskInlineRow>

export function getSubtaskIndicatorFromProgress(progress: {
  total: number
  done: number
}) {
  if (progress.total === 0) return null
  return `${String(progress.done)}/${String(progress.total)}`
}

export function buildFlatTaskInlinePath(
  task: Doc<"tasks">,
  taskById: Map<Id<"tasks">, Doc<"tasks">>,
  statusView: TaskStatusView
): TaskInlinePath {
  const subtaskIndicator = getSubtaskIndicatorFromProgress(statusView.progress)

  if (task.parent.type === "tasks") {
    const parent = taskById.get(task.parent.id)
    return {
      taskTitle: task.name,
      subtaskTitle: parent?.name ?? "",
      subtaskIndicator,
      taskTitleId: task._id,
      subtaskTitleId: task.parent.id,
    }
  }

  return {
    taskTitle: task.name,
    subtaskTitle: "",
    subtaskIndicator,
    taskTitleId: task._id,
    subtaskTitleId: null,
  }
}
