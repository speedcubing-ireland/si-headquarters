import { createFileRoute } from "@tanstack/react-router"
import { Task } from "@/features/tasks/task-page"

export const Route = createFileRoute("/task")({
  component: Task,
})
