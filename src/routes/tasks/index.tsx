import { TaskListPage } from "@/features/tasks/list/task-list-page"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/tasks/")({
  component: TaskListPage,
})
