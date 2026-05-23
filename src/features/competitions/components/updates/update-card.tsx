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
import type { Doc } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { useMutation, useQuery } from "convex/react"
import { Streamdown } from "streamdown"
import { AddUpdateDialog } from "./add-update-dialog"
import { DeleteUpdateDialog } from "./delete-update-dialog"
import { format } from "date-fns"

type CompetitionUpdate = Doc<"competitionUpdates"> & {
  author: PublicUser | null
}

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
  comp,
  update,
}: {
  comp: Doc<"competitions">
  update: CompetitionUpdate | null | undefined
}) {
  const toggleReaction = useMutation(
    api.competitionUpdates.mutations.toggleReaction
  )
  const reactionCounts = useQuery(
    api.competitionUpdates.queries.listReactionCounts,
    update ? { updateId: update._id } : "skip"
  )

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
            onClick={() =>
              toggleReaction({
                updateId: update._id,
                emoji: reaction.emoji,
              })
            }
          >
            <span className="text-center text-lg">{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </Button>
        ))}
        <EmojiPickerPopover
          onEmojiSelect={(emoji) =>
            toggleReaction({
              updateId: update._id,
              emoji: emoji.emoji,
            })
          }
        />
      </CardFooter>
    </Card>
  )
}
