import { ObjectAvatar } from "@/components/object-avatar"
import { useUserItems } from "@/components/data-selectors/user-selector-model"
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
import type { TaskReviewerRef } from "@/convex/tasks/reviews/validators"
import type { TeamSummary } from "@/convex/teams/validators"
import type { PublicUser } from "@/convex/users/validators"
import { useMutation, useQuery } from "convex/react"
import { StampIcon } from "lucide-react"
import { type ComponentProps, useState } from "react"

type SelectReviewer = (reviewer: TaskReviewerRef) => void | Promise<void>

interface ReviewerOption {
  reviewer: TaskReviewerRef
  object: PublicUser | TeamSummary
  name: string
}

interface ReviewerOptionItemProps {
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
  const scope = { type: "tasks", id: taskId } as const
  const users = useUserItems({ open, scope, selectedIds: [] })
  const teams = useQuery(
    api.tasks.queries.listAssignmentTeams,
    open ? { scope } : "skip"
  )
  const addReviewer = useMutation(api.tasks.reviews.mutations.addReviewer)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) users.search.onSearchChange("")
  }

  const addTaskReviewer = async (reviewer: TaskReviewerRef) => {
    await addReviewer({ taskId, reviewer })
    handleOpenChange(false)
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
            <StampIcon />
            Add Reviewer
          </>
        )}
      </Button>
      <CommandDialog
        title="Add reviewer"
        description="Search teams and people"
        open={open}
        onOpenChange={handleOpenChange}
      >
        <Command>
          <CommandInput
            placeholder="Search reviewers..."
            value={users.search.searchQuery}
            onValueChange={users.search.onSearchChange}
          />
          <CommandList>
            <CommandEmpty>
              {users.loading || teams === undefined
                ? "Loading reviewers..."
                : "No reviewers found."}
            </CommandEmpty>
            <CommandGroup heading="Teams">
              {(teams ?? []).map((team) => (
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
              {(users.items ?? []).map((user) => (
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
          {users.pagination !== undefined ? (
            <Button
              type="button"
              variant="ghost"
              disabled={users.pagination.loading}
              onClick={users.pagination.onLoadMore}
            >
              {users.pagination.loading
                ? "Loading more people..."
                : "Load more people"}
            </Button>
          ) : null}
        </Command>
      </CommandDialog>
    </>
  )
}

function ReviewerOptionItem({ onSelect, option }: ReviewerOptionItemProps) {
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
