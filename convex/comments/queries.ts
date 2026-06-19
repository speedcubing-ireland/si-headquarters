import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { publicUserValidator, type PublicUser } from "@/convex/users/validators"
import { getPublicUser, toPublicUser } from "@/convex/users/queries"
import {
  canModerateComments,
  canUserReadCommentTarget,
  filterMentionableUserIds,
  requireCommentTargetRead,
} from "@/convex/comments/access"
import { comments } from "@/convex/comments/client"
import { resolveMentions } from "@/convex/comments/mentions"
import { commentListValidator } from "@/convex/comments/validators"
import { commentTargetRef, objectRefKey } from "@/convex/utils"

const MAX_COMMENTS = 200
const MENTION_POOL = 24
const MENTION_SUGGESTIONS = 6

export const list = query({
  args: {
    target: commentTargetRef,
  },
  returns: commentListValidator,
  handler: async (ctx, args) => {
    const { principal } = await requireCommentTargetRead(ctx, args.target)
    const canModerate = canModerateComments(principal)

    const zone = await comments.getZone(ctx, {
      entityId: objectRefKey(args.target),
    })
    if (zone === null) return { canModerate, comments: [] }

    const { threads } = await comments.getThreads(ctx, { zoneId: zone._id })
    if (threads.length === 0) return { canModerate, comments: [] }

    const { messages } = await comments.getMessages(ctx, {
      threadId: threads[0].thread._id,
      currentUserId: principal.userId,
      order: "asc",
      limit: MAX_COMMENTS,
    })

    const mentionNames = await resolveMentions(
      ctx,
      messages.flatMap((entry) =>
        entry.message.mentions.map((mention) => mention.userId)
      )
    )

    const readableMentionIds = new Set(
      await filterMentionableUserIds(
        ctx,
        args.target,
        [...mentionNames.values()].map((mention) => mention.id)
      )
    )

    const distinctAuthorIds = [
      ...new Set(messages.map(({ message }) => message.authorId)),
    ]
    const authors = new Map<string, PublicUser | null>(
      await Promise.all(
        distinctAuthorIds.map(async (rawId) => {
          const authorId = ctx.db.normalizeId("users", rawId)
          const author =
            authorId === null ? null : await getPublicUser(ctx, authorId)
          return [rawId, author] as const
        })
      )
    )

    const rows = messages.map(({ message, reactions }) => {
      const seen = new Set<string>()
      const mentions = []
      for (const mention of message.mentions) {
        const resolved = mentionNames.get(mention.userId)
        if (
          resolved === undefined ||
          seen.has(mention.userId) ||
          !readableMentionIds.has(resolved.id)
        )
          continue
        seen.add(mention.userId)
        mentions.push({ userId: resolved.id, name: resolved.name })
      }

      return {
        messageId: message._id,
        author: authors.get(message.authorId) ?? null,
        body: message.body,
        mentions,
        reactions: reactions.map((reaction) => ({
          emoji: reaction.emoji,
          count: reaction.count,
          selected: reaction.includesMe,
        })),
        createdAt: message.createdAt,
        isEdited: message.isEdited,
        mine: message.authorId === principal.userId,
      }
    })

    return { canModerate, comments: rows }
  },
})

export const searchMentionableUsers = query({
  args: {
    target: commentTargetRef,
    query: v.string(),
  },
  returns: v.array(publicUserValidator),
  handler: async (ctx, args) => {
    await requireCommentTargetRead(ctx, args.target)
    const search = args.query.trim()
    if (search === "") return []

    const candidates = await ctx.db
      .query("users")
      .withSearchIndex("search_name", (q) => q.search("name", search))
      .take(MENTION_POOL)

    const mentionable = await Promise.all(
      candidates.map(async (user) =>
        (await canUserReadCommentTarget(ctx, user._id, args.target))
          ? toPublicUser(user)
          : null
      )
    )
    return mentionable
      .filter((user) => user !== null)
      .slice(0, MENTION_SUGGESTIONS)
  },
})
