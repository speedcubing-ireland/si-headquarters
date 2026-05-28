import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { PotentialBlockerTask } from "@/convex/tasks/blockers/validators"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeftToLineIcon, ArrowRightToLineIcon } from "lucide-react"
import { type ComponentProps, useState } from "react"

type BlockerLinkMode = "add-blocker" | "mark-blocking"

type AddTaskBlockerButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onClick"
> & {
  taskId: Id<"tasks">
  mode?: BlockerLinkMode
}

const MODE_COPY = {
  "add-blocker": {
    title: "Add blocker",
    description: "Choose a task that blocks this one",
    label: "Add Blocker",
    icon: ArrowRightToLineIcon,
  },
  "mark-blocking": {
    title: "Mark blocking",
    description: "Choose a task that this one blocks",
    label: "Mark Blocking",
    icon: ArrowLeftToLineIcon,
  },
} satisfies Record<
  BlockerLinkMode,
  {
    title: string
    description: string
    label: string
    icon: typeof ArrowRightToLineIcon
  }
>

export function AddTaskBlockerButton({
  children,
  taskId,
  mode = "add-blocker",
  variant = mode === "add-blocker" ? "default" : "outline",
  ...buttonProps
}: AddTaskBlockerButtonProps) {
  const copy = MODE_COPY[mode]
  const Icon = copy.icon
  const [open, setOpen] = useState(false)
  const potentialBlockers = useQuery(
    api.tasks.blockers.queries.listPotentialBlockers,
    open ? { taskId } : "skip"
  )
  const addBlocker = useMutation(api.tasks.blockers.mutations.addBlocker)

  const linkBlocker = async (otherTaskId: Id<"tasks">) => {
    if (mode === "add-blocker") {
      await addBlocker({
        blockedTaskId: taskId,
        blockingTaskId: otherTaskId,
      })
    } else {
      await addBlocker({
        blockedTaskId: otherTaskId,
        blockingTaskId: taskId,
      })
    }
    setOpen(false)
  }

  return (
    <>
      <Button
        {...buttonProps}
        variant={variant}
        onClick={() => {
          setOpen(true)
        }}
      >
        {children ?? (
          <>
            <Icon />
            {copy.label}
          </>
        )}
      </Button>
      <CommandDialog
        title={copy.title}
        description={copy.description}
        open={open}
        onOpenChange={setOpen}
      >
        <Command>
          <CommandInput placeholder="Search tasks..." />
          <CommandList>
            <CommandEmpty>
              {potentialBlockers === undefined
                ? "Loading tasks..."
                : "No tasks found."}
            </CommandEmpty>
            <CommandGroup heading="Tasks">
              {(potentialBlockers ?? []).map((task) => (
                <BlockerOptionItem
                  key={task._id}
                  task={task}
                  onSelect={linkBlocker}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

function BlockerOptionItem({
  onSelect,
  task,
}: {
  onSelect: (taskId: Id<"tasks">) => void | Promise<void>
  task: PotentialBlockerTask
}) {
  return (
    <CommandItem
      value={`${task.name} ${task._id}`}
      onSelect={() => void onSelect(task._id)}
    >
      <span className="truncate">{task.name}</span>
    </CommandItem>
  )
}
