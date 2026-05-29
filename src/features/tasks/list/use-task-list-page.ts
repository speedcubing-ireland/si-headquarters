import { use } from "react"
import { TaskListContext } from "@/features/tasks/list/task-list-context-types"

export function useTaskListPage() {
  const value = use(TaskListContext)
  if (!value) {
    throw new Error("useTaskListPage must be used within TaskListProvider")
  }
  return value
}
