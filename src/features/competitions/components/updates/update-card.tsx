import { ObjectAvatar } from "@/components/object-avatar"
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
import { EmojiPickerPopover } from "@/components/ui/emoji-picker"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { Streamdown } from "streamdown"
import { AddUpdateDialog } from "./add-update-dialog"
import { DeleteUpdateDialog } from "./delete-update-dialog"
import { format } from "date-fns"

function EmptyUpdateCard({ comp }: { comp: Doc<"competitions"> }) {
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="pt-2">Competition update</CardTitle>
        <CardAction>
          <AddUpdateDialog comp={comp} />
        </CardAction>
      </CardHeader>
      <CardContent divided className="border-t">
        <p className="pt-2 text-sm text-muted-foreground">
          No update posted yet.
        </p>
      </CardContent>
    </Card>
  )
}

export function UpdateCard({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const updateDetails = useQuery(api.competitions.queries.getCurrentUpdate, {
    id: competitionId,
  })
  const toggleReaction = useMutation(
    api.competitionUpdates.mutations.toggleReaction
  )
  const update = updateDetails?.update
  const reactionCounts = useQuery(
    api.competitionUpdates.queries.listReactionCounts,
    update ? { updateId: update._id } : "skip"
  )

  if (updateDetails === undefined) {
    return (
      <Card className="col-span-full min-h-48">
        <CardHeader>
          <CardTitle className="pt-2">Competition update</CardTitle>
        </CardHeader>
        <CardContent divided className="border-t">
          <p className="pt-2 text-sm text-muted-foreground">
            Loading update...
          </p>
        </CardContent>
        <CardFooter className="min-h-12" />
      </Card>
    )
  }

  const comp = updateDetails.competition
  if (!update) return <EmptyUpdateCard comp={comp} />

  const authorName = update.author?.name ?? "Unknown user"

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 pt-2">
          {update.author && <ObjectAvatar obj={update.author} size="sm" />}
          {authorName}
          <Badge variant="secondary">
            {format(new Date(update.editedAt), "P")}
          </Badge>
        </CardTitle>
        <CardAction className="flex gap-2">
          <DeleteUpdateDialog comp={comp} />
          <AddUpdateDialog comp={comp} />
        </CardAction>
      </CardHeader>
      <CardContent divided className="border-t">
        <Streamdown className="pt-2">{update.body}</Streamdown>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {(reactionCounts ?? []).map((reaction) => (
          <Button
            key={reaction.emoji}
            size="sm"
            variant={reaction.selected ? "default" : "outline"}
            onClick={() => {
              void toggleReaction({
                updateId: update._id,
                emoji: reaction.emoji,
              })
            }}
          >
            <span className="text-center text-lg">{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </Button>
        ))}
        <EmojiPickerPopover
          onEmojiSelect={(emoji) => {
            void toggleReaction({
              updateId: update._id,
              emoji: emoji.emoji,
            })
          }}
        />
      </CardFooter>
    </Card>
  )
}
