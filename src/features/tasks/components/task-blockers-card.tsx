import { ObjectAvatar } from "@/components/object-avatar"
import {
  PageCard,
  PageCardContent,
  PageCardFooter,
} from "@/components/page-card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { TaskStatusIcon } from "@/features/tasks/status"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { TaskBlockerView } from "@/convex/tasks/blockers/validators"
import { AddTaskBlockerButton } from "@/features/tasks/components/add-task-blocker-button"
import { Link } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowLeftToLineIcon,
  ArrowRightToLineIcon,
  ConstructionIcon,
  TrashIcon,
} from "lucide-react"

function BlockerSection({
  icon,
  items,
  onRemove,
  title,
}: {
  icon: React.ReactNode
  items: TaskBlockerView[]
  onRemove: (edgeId: Id<"taskBlockers">) => void
  title: string
}) {
  if (items.length === 0) return null

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <Label>
        {icon}
        {title}
      </Label>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <BlockerItem key={item._id} item={item} onRemove={onRemove} />
        ))}
      </div>
    </section>
  )
}

function BlockerItem({
  item,
  onRemove,
}: {
  item: TaskBlockerView
  onRemove: (edgeId: Id<"taskBlockers">) => void
}) {
  const assignee = item.task.assignees.primaryUser

  return (
    <Item
      asChild
      variant="outline"
      size="xs"
      className="flex-nowrap items-center gap-2 px-2 py-2"
    >
      <Link to="/tasks/$id" params={{ id: item.task._id }}>
        <ItemMedia variant="icon">
          <TaskStatusIcon status={item.task.effectiveStatus} />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full min-w-0 gap-1.5">
            <span className="truncate">{item.task.name}</span>
          </ItemTitle>
        </ItemContent>
        <ItemActions className="shrink-0 gap-1">
          {assignee !== null && (
            <ObjectAvatar obj={assignee} className="size-5" />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Remove dependency"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRemove(item._id)
            }}
          >
            <TrashIcon className="size-4" />
          </Button>
        </ItemActions>
      </Link>
    </Item>
  )
}

export function TaskBlockersCard({ taskId }: { taskId: Id<"tasks"> }) {
  const blockers = useQuery(api.tasks.blockers.queries.getForTask, {
    id: taskId,
  })
  const removeBlocker = useMutation(api.tasks.blockers.mutations.removeBlocker)

  if (blockers === undefined) {
    return null
  }

  const hasDependencies =
    blockers.blockingMe.length > 0 || blockers.blockedByMe.length > 0

  return (
    <PageCard
      title="Dependencies"
      icon={<ConstructionIcon className="size-4" />}
    >
      <PageCardContent className="flex flex-1 flex-col gap-4">
        {!hasDependencies && (
          <p className="text-sm text-muted-foreground">No dependencies yet.</p>
        )}
        <BlockerSection
          title="Blocked by"
          icon={<ArrowRightToLineIcon className="size-4" />}
          items={blockers.blockingMe}
          onRemove={(edgeId) => {
            void removeBlocker({ id: edgeId })
          }}
        />
        <BlockerSection
          title="Blocking"
          icon={<ArrowLeftToLineIcon className="size-4" />}
          items={blockers.blockedByMe}
          onRemove={(edgeId) => {
            void removeBlocker({ id: edgeId })
          }}
        />
      </PageCardContent>
      <PageCardFooter className="grid grid-cols-2 gap-2">
        <AddTaskBlockerButton taskId={taskId} mode="add-blocker" />
        <AddTaskBlockerButton taskId={taskId} mode="mark-blocking" />
      </PageCardFooter>
    </PageCard>
  )
}
