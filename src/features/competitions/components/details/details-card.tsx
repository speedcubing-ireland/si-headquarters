import * as DateRangeSelector from "@/components/data-selectors/date-range-selector"
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
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { EditDetailsFormDialog } from "@/features/shared/edit-details-form-dialog"
import { useMutation, useQuery } from "convex/react"
import { BellIcon } from "lucide-react"
import { Streamdown } from "streamdown"
import { ProgressTracker } from "./progress-tracker"

export function DetailsCard({
  comp,
  competitionId,
}: {
  comp: Doc<"competitions">
  competitionId: Id<"competitions">
}) {
  const isWatching = useQuery(api.subscriptions.index.getSubscription, {
    object: {
      type: "competitions",
      id: competitionId,
    },
  })
  const isSubscribed = isWatching === true
  const watchingText = isSubscribed ? "Subscribed" : "Subscribe "
  const watchingVariant = isSubscribed ? "ghost" : "outline"
  const onClickWatch = useMutation(api.subscriptions.index.setSubscription)

  const setCompDates = useMutation(api.competitions.mutations.setCompDates)
  const updateDetails = useMutation(api.competitions.mutations.setCompDetails)

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
            <CardTitle className="text-2xl">{comp.name}</CardTitle>
            <DateRangeSelector.Button
              value={{
                from: comp.compDates.from ?? null,
                to: comp.compDates.to ?? null,
              }}
              onChange={({ from, to }) => {
                void setCompDates({ id: competitionId, from, to })
              }}
            />
          </div>
        </div>
        <CardAction>
          <EditDetailsFormDialog
            descriptionId="competition-description"
            descriptionPlaceholder="Add the competition description..."
            initialValue={comp}
            nameId="competition-name"
            title="Edit competition details"
            triggerLabel="Edit competition details"
            onSubmit={(value) => updateDetails({ id: competitionId, ...value })}
          />
        </CardAction>
      </CardHeader>
      <CardContent divided className="border-t">
        <Streamdown>{comp.description ?? "Enter a description..."}</Streamdown>
        <ProgressTracker competitionId={competitionId} />
      </CardContent>
      <CardFooter>
        <Button
          size="lg"
          variant={watchingVariant}
          onClick={() => {
            void onClickWatch({
              object: {
                type: "competitions",
                id: competitionId,
              },
              subscribe: !isSubscribed,
            })
          }}
        >
          <BellIcon />
          {watchingText}
        </Button>
      </CardFooter>
    </Card>
  )
}
