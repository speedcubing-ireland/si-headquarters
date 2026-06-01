import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import { TaskBlockersCard } from "@/features/tasks/components/task-blockers-card"
import { TaskDetailsCard } from "@/features/tasks/components/task-details-card"
import { TaskPropertiesCard } from "@/features/tasks/components/task-properties-card"
import { useQuery } from "convex/react"
import { ExternalLinkIcon, PaletteIcon, TrashIcon } from "lucide-react"
import { TaskReviewCard } from "@/features/tasks/components/task-review-card"
import { FlowView } from "../subtasks/flow-view"
import { SubtaskView } from "../subtasks/subtask-view"
import type { Id } from "@/convex/_generated/dataModel"
import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
function IntegrationCard() {
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PaletteIcon className="size-4" />
          Cert Design
          <div className="flex-1" />
          <Badge className="text-sm">Linked</Badge>
          <Button variant="outline">
            <TrashIcon className="size-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center rounded-lg border">
          <img
            className="h-48 w-auto object-contain"
            src={`https://document-export.canva.com/M_WXk/DAG_ClM_WXk/20/thumbnail/0001.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUHWEOTUD6Q%2F20260520%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260520T100449Z&X-Amz-Expires=37896&X-Amz-Signature=fc1f23758b6101e82d90b1ae1a43feae216d6e1dff19a6ef2e69e0c3dab04000&X-Amz-SignedHeaders=host&response-expires=Wed%2C%2020%20May%202026%2020%3A36%3A25%20GMT`}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline">
          Open Design
          <ExternalLinkIcon />
        </Button>
      </CardFooter>
    </Card>
  )
}

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
        <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
          <TaskDetailsCard taskId={taskId} />
          <IntegrationCard />
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
