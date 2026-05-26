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
import { TaskDetailsCard } from "@/features/tasks/components/task-details-card"
import { TaskPropertiesCard } from "@/features/tasks/components/task-properties-card"
import { cn } from "@/lib/utils"
import { useQuery } from "convex/react"
import {
  ArrowLeftToLineIcon,
  ArrowRightToLineIcon,
  CircleCheckIcon,
  CircleIcon,
  ConstructionIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  PaletteIcon,
  TrashIcon,
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { TaskReviewCard } from "@/features/tasks/components/task-review-card"
import { FlowView } from "../subtasks/flow-view"
import { SubtaskView } from "../subtasks/subtask-view"
import type { Id } from "@/convex/_generated/dataModel"

const blockedByTasks = [
  {
    id: "#128",
    title: "Approve certificate template",
    assignee: "BR",
    avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=B R",
    status: "todo",
  },
  {
    id: "#132",
    title: "Send sponsor logos",
    assignee: "CM",
    avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=C M",
    status: "done",
  },
] as const

const blockingTasks = [
  {
    id: "#141",
    title: "Print awards pack",
    assignee: "OP",
    avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=O P",
    status: "todo",
  },
  {
    id: "#146",
    title: "Publish winner assets",
    assignee: "MD",
    avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=M D",
    status: "progress",
  },
] as const

const dependencyStatus = {
  todo: {
    label: "To-do",
    icon: CircleIcon,
    className: "text-muted-foreground",
  },
  progress: {
    label: "In progress",
    icon: LoaderCircleIcon,
    className: "text-yellow-600",
  },
  done: {
    label: "Done",
    icon: CircleCheckIcon,
    className: "text-emerald-600",
  },
}

type DependencyTask =
  | (typeof blockedByTasks)[number]
  | (typeof blockingTasks)[number]

function DependenciesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Dependencies
          <ConstructionIcon className="size-4" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {/* To-do needs empty state to fill space */}
        <DependencySection
          title="Blocked by"
          icon={<ArrowRightToLineIcon className="size-4" />}
          items={blockedByTasks}
        />
        <DependencySection
          title="Blocking"
          icon={<ArrowLeftToLineIcon className="size-4" />}
          items={blockingTasks}
        />
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2">
        <Button>
          <ArrowRightToLineIcon />
          Add Blocker
        </Button>
        <Button variant="outline">
          <ArrowLeftToLineIcon />
          Mark Blocking
        </Button>
      </CardFooter>
    </Card>
  )
}

function DependencySection({
  title,
  icon,
  items,
}: {
  title: string
  icon: React.ReactNode
  items: readonly DependencyTask[]
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <Label>
        {icon}
        {title}
      </Label>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <DependencyItem key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

function DependencyItem({ item }: { item: DependencyTask }) {
  const status = dependencyStatus[item.status]
  const StatusIcon = status.icon

  return (
    <Item
      asChild
      variant="outline"
      size="xs"
      className="flex-nowrap items-center gap-2 px-2 py-2"
    >
      <a href="">
        <ItemMedia variant="icon">
          <StatusIcon
            aria-label={status.label}
            className={cn("size-4", status.className)}
          />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full min-w-0 gap-1.5">
            <span className="truncate">
              {item.id} {item.title}
            </span>
          </ItemTitle>
        </ItemContent>
        <ItemActions className="shrink-0 gap-1">
          <Avatar className="size-5">
            <AvatarImage src={item.avatarUrl} />
            <AvatarFallback>{item.assignee}</AvatarFallback>
          </Avatar>
        </ItemActions>
      </a>
    </Item>
  )
}

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

export function Task({ taskId }: {
  taskId: Id<"tasks">
}) {
  const root = useQuery(api.tasks.queries.getPageRoot, {
    id: taskId
  })

  if (root === null) {
    return "Task not found."
  }

  if (root === undefined) {
    return <></>
  }


  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
      <TaskDetailsCard taskId={taskId} />
      <IntegrationCard />
      <TaskPropertiesCard taskId={taskId} />
      <DependenciesCard />
      <TaskReviewCard taskId={taskId} />
      {root.kind === "flow" ? (
        <FlowView taskId={taskId} />
      ) : (
        <SubtaskView owner={{ type: "tasks", id: taskId }} />
      )}
      <div className="h-96" />
    </div>
  )
}
