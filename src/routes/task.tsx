import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { createFileRoute } from '@tanstack/react-router'
import { AlarmClockPlusIcon, ArrowLeftToLineIcon, ArrowRightToLineIcon, BellIcon, BlocksIcon, CalendarIcon, CastleIcon, CircleCheckIcon, CircleIcon, ConstructionIcon, CornerDownRightIcon, HandIcon, InfoIcon, LoaderCircleIcon, PencilIcon, PlusIcon, TargetIcon, TrafficConeIcon, TrashIcon, UserIcon } from 'lucide-react';
import { Streamdown } from "streamdown";
import DemoContent from "../../DEMO_CONTENT.md?raw";
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import InlineDataView from '@/components/data-views/inline-data-view';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';


export const Route = createFileRoute('/task')({
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
]

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
]

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

function PropertiesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Properties
          <InfoIcon className="size-4"/>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
            <TargetIcon className="size-4" />
            Due Date
          </Label>
          <Button variant="outline">
            <CalendarIcon />
            Jun 19
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DependenciesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Dependencies
          <ConstructionIcon className="size-4"/>
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
  );
}

function DependencySection({
  title,
  icon,
  items,
}: {
  title: string
  icon: React.ReactNode
  items: typeof blockedByTasks
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

function DependencyItem({ item }: { item: (typeof blockedByTasks)[number] }) {
  const status = dependencyStatus[item.status]
  const StatusIcon = status.icon

  return (
    <Item asChild variant="outline" size="xs" className="flex-nowrap gap-2 px-2 py-2 items-center">
      <a href="">
      <ItemMedia variant="icon">
        <StatusIcon aria-label={status.label} className={cn("size-4", status.className)} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full min-w-0 gap-1.5">
          <span className="truncate">{ item.id} {item.title}</span>
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

function Competition() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 mx-auto w-full max-w-3xl gap-6">
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="text-2xl">Design Certificates</CardTitle>
          <div className="flex items-center gap-1 pt-1">
            <CornerDownRightIcon className="size-4" />
            <Button variant="outline" size="sm">
              Certificates
              <Badge
                variant="outline"
                className={cn("shrink-0 text-sm")}
              >
                <LoaderCircleIcon data-icon="inline-start" />
                1/3
              </Badge>
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
            <AlarmClockPlusIcon/>
            Reminders
          </Button>
          <div className="flex-1" />
          <Button size="lg" variant="destructive">
            <TrashIcon />
            Delete
          </Button>
        </CardFooter>
      </Card>
      <PropertiesCard />
      <DependenciesCard />
      <InlineDataView />
      <div className="h-96" />
    </div>
  );
}
