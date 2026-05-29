import { TasksPage } from "@/features/tasks/list/tasks-page"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/tasks/")({
  component: TasksPage,
})
