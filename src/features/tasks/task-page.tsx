import { api } from "@/convex/_generated/api"
import { TaskIntegrationsSection } from "@/features/integrations/task-integrations-section"
import { TaskBlockersCard } from "@/features/tasks/components/task-blockers-card"
import { TaskDetailsCard } from "@/features/tasks/components/task-details-card"
import { TaskPropertiesCard } from "@/features/tasks/components/task-properties-card"
import { useQuery } from "convex/react"
import { TaskReviewCard } from "@/features/tasks/components/task-review-card"
import { FlowView } from "../subtasks/flow-view"
import { SubtaskView } from "../subtasks/subtask-view"
import type { Id } from "@/convex/_generated/dataModel"
import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
export function Task({ taskId }: { taskId: Id<"tasks"> }) {
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
          to: i.type === "tasks" ? "/tasks/$id" : "/competitions/$id",
          params: { id: i.id },
        }))}
      />
    ) : (
      <Page.Title>Task</Page.Title>
    )

  return (
    <Page.Shell header={header} contentClassName={PAGE_CONTENT_PADDING_SCROLL}>
      {root === undefined ? (
        <Page.Status variant="loading" message="Loading task…" />
      ) : root === null ? (
        <Page.Status variant="empty" message="Task not found." />
      ) : (
        <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 @sm/main:grid-cols-2">
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
        </div>
      )}
    </Page.Shell>
  )
}
