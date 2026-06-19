import { api } from "@/convex/_generated/api"
import type { CommentTargetRef } from "@/convex/utils"
import { CommentsCard } from "@/features/comments/comments-card"
import { useMutation, useQuery } from "convex/react"

export function CommentsCardContainer({
  target,
}: {
  target: CommentTargetRef
}) {
  const data = useQuery(api.comments.queries.list, { target })

  const add = useMutation(api.comments.mutations.add)
  const edit = useMutation(api.comments.mutations.edit)
  const remove = useMutation(api.comments.mutations.remove)
  const toggleReaction = useMutation(api.comments.mutations.toggleReaction)

  if (data === undefined) return null

  return (
    <CommentsCard
      comments={data.comments}
      canModerate={data.canModerate}
      target={target}
      onAdd={async (body) => {
        await add({ target, body })
      }}
      onEdit={async (messageId, body) => {
        await edit({ target, messageId, body })
      }}
      onRemove={(messageId) => {
        void remove({ target, messageId })
      }}
      onToggleReaction={(messageId, emoji) => {
        void toggleReaction({ target, messageId, emoji })
      }}
    />
  )
}
