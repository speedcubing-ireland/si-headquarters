import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { createFileRoute } from "@tanstack/react-router"
import {
  AlarmClockPlusIcon,
  AlertCircleIcon,
  ArrowLeftToLineIcon,
  ArrowRightToLineIcon,
  BadgeCheckIcon,
  BadgeIcon,
  BellIcon,
  CableIcon,
  CalendarIcon,
  CastleIcon,
  CircleCheckIcon,
  CircleIcon,
  CircleXIcon,
  ConstructionIcon,
  CornerDownRightIcon,
  ExternalLinkIcon,
  HandIcon,
  InfoIcon,
  LoaderCircleIcon,
  PaletteIcon,
  PencilIcon,
  StampIcon,
  TagIcon,
  TargetIcon,
  TrafficConeIcon,
  TrashIcon,
  UserIcon,
} from "lucide-react"
import { Streamdown } from "streamdown"
import DemoContent from "../../DEMO_CONTENT.md?raw"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert"
import FlowDataView from "@/components/data-views/flow-data-view"
import { useState } from "react"
import TaskDataView from "@/components/data-views/task-data-view"

export const Route = createFileRoute("/task")({
  component: Competition,
})

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

function PropertiesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Properties
          <InfoIcon className="size-4" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex justify-between">
          <Label>
            <TrafficConeIcon className="size-4" />
            Status
          </Label>
          <Button variant="outline">
            <CircleIcon />
            To-do
          </Button>
        </div>
        <div className="flex justify-between">
          <Label>
            <UserIcon className="size-4" />
            Assignee
          </Label>
          <Button variant="outline">
            <Avatar size="sm">
              <AvatarImage src="https://github.com/simonkellly.png" />
            </Avatar>
            Simon
          </Button>
        </div>
        <div className="flex justify-between">
          <Label>
            <CastleIcon className="size-4" />
            Owner
          </Label>
          <Button variant="outline">
            <Avatar size="sm">
              <AvatarImage src="https://api.dicebear.com/9.x/initials/svg?seed=C T" />
            </Avatar>
            Competitions
          </Button>
        </div>
        <div className="flex justify-between">
          <Label>
            <TagIcon className="size-4" />
            Labels
          </Label>
          <Button variant="outline">
            <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              Certificates
            </Badge>
          </Button>
        </div>
        <div className="flex justify-between">
          <Label>
            <TargetIcon className="size-4" />
            Due Date
          </Label>
          <Button variant="outline">
            <CalendarIcon />
            Jun 19
          </Button>
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2">
        <Button variant="outline">
          <StampIcon />
          Add Reviewer
        </Button>
        <Button variant="outline">
          <CableIcon />
          Add Integration
        </Button>
      </CardFooter>
    </Card>
  )
}

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

function ApprovalCard() {
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Approvals
          <StampIcon className="size-4" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <Alert variant="destructive" className="">
          <AlertCircleIcon />
          <AlertTitle>Approval Overridden</AlertTitle>
          <AlertAction className="flex items-center gap-2">
            <Avatar className="size-5">
              <AvatarImage src="https://github.com/simonkellly.png" />
            </Avatar>
            <Button size="xs" variant="destructive">
              <TrashIcon /> Remove
            </Button>
          </AlertAction>
        </Alert>
        <Item variant="outline" className="">
          <ItemMedia variant="icon">
            <BadgeIcon className="size-5" />
          </ItemMedia>
          <ItemTitle>Competitions Team</ItemTitle>
          <ItemContent />
          <ItemActions>
            <Button size="icon" variant="outline">
              <CircleCheckIcon />
            </Button>
            <Button size="icon" variant="outline">
              <TrashIcon />
            </Button>
          </ItemActions>
        </Item>
        <Item variant="outline" className="">
          <ItemMedia variant="icon">
            <BadgeCheckIcon className="size-5" />
          </ItemMedia>
          <ItemTitle>Graphics Team</ItemTitle>
          <ItemContent>
            <Badge>Approved</Badge>
          </ItemContent>
          <ItemActions>
            <Button size="icon" variant="outline">
              <CircleXIcon />
            </Button>
            <Button size="icon" variant="outline">
              <TrashIcon />
            </Button>
          </ItemActions>
        </Item>
      </CardContent>
      <CardFooter className="flex justify-between gap-2">
        <Button variant="outline">Add Reviewer</Button>
        <Button variant="destructive">Override Approval</Button>
      </CardFooter>
    </Card>
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

function Competition() {
  const [flow, setFlow] = useState(true)
  const toggleFlow = () => setFlow((f) => !f)
  const TaskList = flow ? FlowDataView : TaskDataView

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="text-2xl">Design Certificates</CardTitle>
          <div className="flex items-center gap-1 pt-1">
            <CornerDownRightIcon className="size-4" />
            <Button variant="outline" size="sm">
              Certificates
              <Badge variant="outline" className={cn("shrink-0 text-sm")}>
                <LoaderCircleIcon data-icon="inline-start" />
                1/3
              </Badge>
            </Button>
            <Button variant="outline" size="sm">
              <CalendarIcon />
              Jun 19
            </Button>
          </div>
          <CardAction>
            <Button variant="outline" size="icon">
              <PencilIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent divided className="border-t">
          <Streamdown>{DemoContent}</Streamdown>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button size="lg">
            <HandIcon />
            Claim
            {/* Claim -> Start -> Finish and Nudge for others*/}
          </Button>
          <Button size="lg" variant="outline">
            <BellIcon />
            Watch
          </Button>
          <Button size="lg" variant="outline">
            <AlarmClockPlusIcon />
            Reminders
          </Button>
        </CardFooter>
      </Card>
      <IntegrationCard />
      <PropertiesCard />
      <DependenciesCard />
      <ApprovalCard />
      <TaskList toggleFlow={toggleFlow} />
      <div className="h-96" />
    </div>
  )
}
