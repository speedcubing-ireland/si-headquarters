import { ObjectAvatar } from "@/components/object-avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type {
  PotentialTaskReviewers,
  TaskReviewerRef,
} from "@/convex/tasks/reviews/validators"
import { useMutation, useQuery } from "convex/react"
import { StampIcon } from "lucide-react"
import { type ComponentProps, useState } from "react"

type ReviewerType = TaskReviewerRef["type"]
type PotentialReviewer = PotentialTaskReviewers[ReviewerType][number]
type SelectReviewer = (reviewer: TaskReviewerRef) => void | Promise<void>

type ReviewerOption = {
  reviewer: TaskReviewerRef
  object: PotentialReviewer
  name: string
}

type ReviewerOptionItemProps = {
  onSelect: SelectReviewer
  option: ReviewerOption
}

type AddTaskReviewerButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onClick"
> & {
  taskId: Id<"tasks">
}

export function AddTaskReviewerButton({
  children,
  taskId,
  variant = "outline",
  ...buttonProps
}: AddTaskReviewerButtonProps) {
  const [open, setOpen] = useState(false)
  const potentialReviewers = useQuery(
    api.tasks.reviews.queries.listPotentialReviewers,
    open ? {} : "skip"
  )
  const addReviewer = useMutation(api.tasks.reviews.mutations.addReviewer)

  const addTaskReviewer = async (reviewer: TaskReviewerRef) => {
    await addReviewer({ taskId, reviewer })
    setOpen(false)
  }

  return (
    <>
      <Button {...buttonProps} variant={variant} onClick={() => setOpen(true)}>
        {children ?? (
          <>
            <StampIcon />
            Add Reviewer
          </>
        )}
      </Button>
      <CommandDialog
        title="Add reviewer"
        description="Search teams and people"
        open={open}
        onOpenChange={setOpen}
      >
        <Command>
          <CommandInput placeholder="Search reviewers..." />
          <CommandList>
            <CommandEmpty>
              {potentialReviewers === undefined
                ? "Loading reviewers..."
                : "No reviewers found."}
            </CommandEmpty>
            <CommandGroup heading="Teams">
              {(potentialReviewers?.teams ?? []).map((team) => (
                <ReviewerOptionItem
                  key={team._id}
                  option={{
                    reviewer: { type: "teams", id: team._id },
                    object: team,
                    name: team.name,
                  }}
                  onSelect={addTaskReviewer}
                />
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="People">
              {(potentialReviewers?.users ?? []).map((user) => (
                <ReviewerOptionItem
                  key={user._id}
                  option={{
                    reviewer: { type: "users", id: user._id },
                    object: user,
                    name: user.name ?? "Unknown user",
                  }}
                  onSelect={addTaskReviewer}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

function ReviewerOptionItem({
  onSelect,
  option,
}: ReviewerOptionItemProps) {
  return (
    <CommandItem
      value={`${option.name} ${option.reviewer.id}`}
      onSelect={() => void onSelect(option.reviewer)}
    >
      <ObjectAvatar obj={option.object} size="sm" />
      <span className="truncate">{option.name}</span>
    </CommandItem>
  )
}
