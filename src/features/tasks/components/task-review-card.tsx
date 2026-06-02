import {
  PageCard,
  PageCardContent,
  PageCardFooter,
} from "@/components/page-card"
import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AddTaskReviewerButton } from "@/features/tasks/components/add-task-reviewer-button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { api } from "@/convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import type {
  TaskReviewerDetailsForTask,
  TaskReviewOverrideDetails,
} from "@/convex/tasks/reviews/validators"
import {
  AlertCircleIcon,
  CircleCheckIcon,
  CircleXIcon,
  StampIcon,
  TrashIcon,
  BadgeCheckIcon,
  BadgeIcon,
} from "lucide-react"
import { ObjectAvatar } from "@/components/object-avatar"
import type { Id } from "@/convex/_generated/dataModel"

function ShowOverrideAlert({
  taskId,
  override,
}: {
  taskId: Id<"tasks">
  override: TaskReviewOverrideDetails
}) {
  const removeOverride = useMutation(
    api.tasks.reviews.mutations.removeApprovalOverride
  )

  return (
    <Alert variant="destructive" className="">
      <AlertCircleIcon />
      <AlertTitle>Approval Overridden</AlertTitle>
      <AlertAction className="flex items-center gap-2">
        {override.overriddenBy && (
          <ObjectAvatar obj={override.overriddenBy} className="size-5" />
        )}
        <Button
          size="xs"
          variant="destructive"
          onClick={() => {
            void removeOverride({ taskId })
          }}
        >
          <TrashIcon /> Remove
        </Button>
      </AlertAction>
    </Alert>
  )
}

function ReviewerRow({
  taskId,
  reviewer,
}: {
  taskId: Id<"tasks">
  reviewer: TaskReviewerDetailsForTask["reviewers"][number]
}) {
  const approveTaskReview = useMutation(
    api.tasks.reviews.mutations.approveReviewer
  )
  const revokeApproval = useMutation(
    api.tasks.reviews.mutations.revokeReviewerApproval
  )
  const removeReviewer = useMutation(api.tasks.reviews.mutations.removeReviewer)

  return (
    <Item key={reviewer._id} variant="outline" className="">
      <ItemMedia variant="icon">
        {reviewer.approved ? (
          <BadgeCheckIcon className="size-5" />
        ) : (
          <BadgeIcon className="size-5" />
        )}
      </ItemMedia>
      <ItemTitle>{reviewer.name ?? "Unknown reviewer"}</ItemTitle>
      <ItemContent>{reviewer.approved && <Badge>Approved</Badge>}</ItemContent>
      <ItemActions>
        {!reviewer.approved && (
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              void approveTaskReview({
                taskId,
                reviewer: reviewer.reviewer,
              })
            }}
          >
            <CircleCheckIcon />
          </Button>
        )}
        {reviewer.approved && (
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              void revokeApproval({ taskId, reviewer: reviewer.reviewer })
            }}
          >
            <CircleXIcon />
          </Button>
        )}
        <Button
          size="icon"
          variant="outline"
          onClick={() => {
            void removeReviewer({ taskId, reviewer: reviewer.reviewer })
          }}
        >
          <TrashIcon />
        </Button>
      </ItemActions>
    </Item>
  )
}

export function TaskReviewCard({ taskId }: { taskId: Id<"tasks"> }) {
  const taskReviewDetails = useQuery(
    api.tasks.reviews.queries.getReviewerDetailsForTask,
    {
      taskId,
    }
  )

  const override = taskReviewDetails?.override
  const reviewers = taskReviewDetails?.reviewers ?? []

  const createOverride = useMutation(
    api.tasks.reviews.mutations.overrideApproval
  )

  if (taskReviewDetails === undefined) {
    return null
  }

  if (reviewers.length === 0 && !override) {
    return null
  }

  return (
    <PageCard
      title="Approvals"
      icon={<StampIcon className="size-4" />}
      className="col-span-full"
    >
      <PageCardContent className="gap-2">
        {override && <ShowOverrideAlert override={override} taskId={taskId} />}
        {reviewers.map((reviewer) => (
          <ReviewerRow key={reviewer._id} reviewer={reviewer} taskId={taskId} />
        ))}
      </PageCardContent>
      <PageCardFooter className="flex justify-between gap-2">
        <AddTaskReviewerButton taskId={taskId} />
        <Button
          variant="destructive"
          onClick={() => {
            void createOverride({ taskId })
          }}
        >
          Override Approval
        </Button>
      </PageCardFooter>
    </PageCard>
  )
}
