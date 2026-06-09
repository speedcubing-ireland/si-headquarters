import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { UpdateCard } from "@/features/updates/update-card"

type UpdatableObject = Doc<"objectUpdates">["object"]

export function CurrentUpdateCard({
  object,
  title,
}: {
  object: UpdatableObject
  title: string
}) {
  const details = useQuery(api.updates.queries.getCurrent, { object })
  const setUpdate = useMutation(api.updates.mutations.setCurrent)
  const deleteUpdate = useMutation(api.updates.mutations.deleteCurrent)
  const toggleReaction = useMutation(api.updates.mutations.toggleReaction)
  const reactionCounts = useQuery(
    api.updates.queries.listReactionCounts,
    details?.update ? { updateId: details.update._id } : "skip"
  )

  if (details === undefined) {
    return null
  }

  return (
    <UpdateCard
      editorId={`${object.type}-update`}
      placeholder={`Add the ${title.toLowerCase()}...`}
      reactions={reactionCounts ?? []}
      title={title}
      update={
        details.update === null
          ? null
          : {
              ...details.update,
              author: details.author,
            }
      }
      onAdd={async (body) => {
        await setUpdate({ object, body })
      }}
      onDelete={() => {
        void deleteUpdate({ object })
      }}
      onToggleReaction={(emoji) => {
        if (details.update === null) return
        void toggleReaction({
          updateId: details.update._id,
          emoji,
        })
      }}
    />
  )
}
