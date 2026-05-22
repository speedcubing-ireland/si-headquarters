import { DatePickerWithRange } from "@/components/data-selectors/date-range-picker"
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
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import {
  BellIcon,
} from "lucide-react"
import { Streamdown } from "streamdown"
import { EditDetailsDialog } from "./edit-details-dialog"
import { cn } from "@/lib/utils";

const DEMO_DETAILS = {
  name: "My Cool Task",
  description: "This is an example task used for development",
  phase: "Pre-Launch",
  progress: {
    phaseTaskCount: 15,
    done: 7,
    inProgress: 3,
    blocked: 1,
    completionPercent: Math.round((100 * 7) / 15),
  },
}

function ProgressSegment({
  className,
  count,
  total,
}: {
  className: string
  count: number
  total: number
}) {
  if (count <= 0 || total <= 0) return null

  return (
    <div
      className={cn("h-full shrink-0", className)}
      style={{ width: `${(count / total) * 100}%` }}
    />
  )
}

function ProgressTracker() {
  // TODO: This needs to be implemented after tasks
  const { progress } = DEMO_DETAILS

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <Badge variant="outline">Pre-Announcement</Badge>
        <span className="font-medium">
          {progress.completionPercent}% complete
        </span>
      </div>
      <div
        aria-label={`${progress.done} done, ${progress.inProgress} in progress, ${progress.blocked} blocked out of ${progress.phaseTaskCount} total`}
        aria-valuemax={progress.phaseTaskCount}
        aria-valuemin={0}
        aria-valuenow={progress.done + progress.inProgress + progress.blocked}
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <ProgressSegment
          className="bg-primary"
          count={progress.done}
          total={progress.phaseTaskCount}
        />
        <ProgressSegment
          className="bg-yellow-500"
          count={progress.inProgress}
          total={progress.phaseTaskCount}
        />
        <ProgressSegment
          className="bg-destructive"
          count={progress.blocked}
          total={progress.phaseTaskCount}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{progress.done}</span>{" "}
          done
        </span>
        <span>
          <span className="font-medium text-foreground">
            {progress.inProgress}
          </span>{" "}
          in progress
        </span>
        <span>
          <span className="font-medium text-foreground">
            {progress.phaseTaskCount}
          </span>{" "}
          total
        </span>
        {progress.blocked > 0 && (
          <span className="text-destructive">
            <span className="font-medium">{progress.blocked}</span> blocked
          </span>
        )}
      </div>
    </div>
  )
}


export function DetailsCard({ comp }: { comp: Doc<"competitions"> }) {
  const iconUrl = `https://api.dicebear.com/9.x/glass/svg?seed=${comp.name}`

  const isWatching = useQuery(api.subscriptions.index.getSubscription, {
    objectType: "competitions",
    objectId: comp._id,
  })
  const watchingText = isWatching ? "Subscribed" : "Subscribe "
  const watchingVariant = isWatching ? "ghost" : "outline"
  const onClickWatch = useMutation(api.subscriptions.index.setSubscription)

  const mutateDate = useMutation(api.competitions.mutations.setCompDates)

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center gap-4">
          <img
            src={iconUrl}
            className="size-12 shrink-0 rounded-lg border border-border object-cover"
          />
          <div className="flex flex-col items-start gap-2">
            <CardTitle className="text-2xl">{comp?.name}</CardTitle>
            <DatePickerWithRange
              from={comp.compDates?.from}
              to={comp.compDates?.to}
              mutateDate={async (from, to) => {
                await mutateDate({ id: comp._id, from, to })
              }}
            />
          </div>
        </div>
        <CardAction>
          <EditDetailsDialog comp={comp} />
        </CardAction>
      </CardHeader>
      <CardContent divided className="border-t">
        <Streamdown>{comp.description ?? "Enter a description..."}</Streamdown>
        <ProgressTracker />
      </CardContent>
      <CardFooter>
        <Button
          size="lg"
          variant={watchingVariant}
          onClick={() =>
            onClickWatch({
              objectType: "competitions",
              objectId: comp._id,
              subscribe: !isWatching,
            })
          }
        >
          <BellIcon />
          {watchingText}
        </Button>
      </CardFooter>
    </Card>
  )
}