import { DatePickerWithRange } from "@/components/data-selectors/date-range-picker"
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
import { BellIcon } from "lucide-react"
import { Streamdown } from "streamdown"
import { EditDetailsDialog } from "./edit-details-dialog"
import { ProgressTracker } from "./progress-tracker"

export function DetailsCard({
  comp
}: {
  comp: Doc<"competitions">
}) {

  const competitionId = comp._id;
  const isWatching = useQuery(api.subscriptions.index.getSubscription, {
    object: {
      type: "competitions",
      id: competitionId,
    },
  })
  const watchingText = isWatching ? "Subscribed" : "Subscribe "
  const watchingVariant = isWatching ? "ghost" : "outline"
  const onClickWatch = useMutation(api.subscriptions.index.setSubscription)

  const setCompDates = useMutation(api.competitions.mutations.setCompDates)

  if (comp === undefined) {
    return (
      <Card className="col-span-full min-h-80">
        <CardHeader>
          <CardTitle className="text-2xl">Loading competition...</CardTitle>
        </CardHeader>
        <CardContent divided className="border-t">
          <p className="text-sm text-muted-foreground">Loading details...</p>
          <ProgressTracker />
        </CardContent>
        <CardFooter>
          <Button size="lg" variant="outline" disabled>
            <BellIcon />
            Subscribe
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const iconUrl = `https://api.dicebear.com/9.x/glass/svg?seed=${comp.name}`

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
              value={{
                from: comp.compDates?.from ?? null,
                to: comp.compDates?.to ?? null,
              }}
              onChange={async ({ from, to }) => {
                await setCompDates({ id: competitionId, from, to })
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
              object: {
                type: "competitions",
                id: competitionId,
              },
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
