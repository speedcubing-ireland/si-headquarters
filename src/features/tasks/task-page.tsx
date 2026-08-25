import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import { TaskIntegrationsSection } from "@/features/integrations/task-integrations-section"
import { FlowView } from "@/features/subtasks/flow-view"
import { SubtaskView } from "@/features/subtasks/subtask-view"
import { TaskBlockersCard } from "@/features/tasks/components/task-blockers-card"
import { TaskDetailsCard } from "@/features/tasks/components/task-details-card"
import { TaskPendingReminders } from "@/features/tasks/components/task-reminders"
import { TaskPropertiesCard } from "@/features/tasks/components/task-properties-card"
import { TaskReviewCard } from "@/features/tasks/components/task-review-card"
import { CommentsCardContainer } from "@/features/comments/comments-card-container"
import { DeleteObjectBar } from "@/features/shared/delete-object-bar"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

export function Task({ taskId }: { taskId: Id<"tasks"> }) {
  const navigate = useNavigate()
  const deleteTask = useMutation(api.tasks.mutations.deleteTask)
  const root = useQuery(api.tasks.queries.getPageRoot, {
    id: taskId,
  })

  const breadcrumbs = root?.breadcrumbs
  const header =
    breadcrumbs && breadcrumbs.length > 0 ? (
      <Page.Breadcrumbs
        items={breadcrumbs.map((i) => ({
          key: i.id,
          label: i.name,
          to:
            i.type === "tasks"
              ? "/tasks/$id"
              : i.type === "projects"
                ? "/projects/$id"
                : "/competitions/$id",
          params: { id: i.id },
        }))}
      />
    ) : (
      <Page.Title>Task</Page.Title>
    )

  return (
    <Page.Shell header={header} contentClassName={PAGE_CONTENT_PADDING_SCROLL}>
      <Page.EntityState
        value={root}
        loadingMessage="Loading task…"
        emptyMessage="Task not found."
      >
        {(root) => (
          <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 @sm/main:grid-cols-2">
            <TaskPendingReminders taskId={taskId} />
            <TaskDetailsCard taskId={taskId} />
            <TaskIntegrationsSection taskId={taskId} />
            <TaskPropertiesCard taskId={taskId} />
            <TaskBlockersCard taskId={taskId} />
            <TaskReviewCard taskId={taskId} />
            {root.kind === "flow" ? (
              <FlowView taskId={taskId} />
            ) : (
              <SubtaskView owner={{ type: "tasks", id: taskId }} />
            )}
            <CommentsCardContainer target={{ type: "tasks", id: taskId }} />
            {root.canDelete ? (
              <DeleteObjectBar
                objectLabel="task"
                description="This permanently removes the task and everything nested beneath it."
                confirmationDescription="All subtasks, comments, reminders, reviews, blockers, and integrations belonging to it will also be deleted."
                onDelete={async () => {
                  await deleteTask({ id: taskId })
                  toast.success("Task deleted")
                  await navigate({ to: "/tasks" })
                }}
              />
            ) : null}
          </div>
        )}
      </Page.EntityState>
    </Page.Shell>
  )
}
