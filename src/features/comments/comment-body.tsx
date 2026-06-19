import type { Id } from "@/convex/_generated/dataModel"
import { replaceMentions } from "@/convex/comments/mentionTokens"
import { Streamdown } from "streamdown"

export interface CommentMention {
  userId: Id<"users">
  name: string
}

export function CommentBody({
  body,
  mentions,
}: {
  body: string
  mentions: CommentMention[]
}) {
  const nameById = new Map<string, string>(
    mentions.map((mention) => [mention.userId, mention.name])
  )
  const rendered = replaceMentions(body, (rawId) => {
    const name = nameById.get(rawId)
    return name === undefined ? undefined : `**@${name}**`
  })

  return <Streamdown className="pt-2">{rendered}</Streamdown>
}
