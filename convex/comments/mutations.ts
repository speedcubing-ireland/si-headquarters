import { ConvexError, v } from "convex/values"
import { mutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import { normalizeEmoji } from "@/convex/emoji"
import { scheduleNotificationEvent } from "@/convex/notifications/events"
import {
  canModerateComments,
  filterMentionableUserIds,
  requireCommentTargetRead,
} from "@/convex/comments/access"
import { comments } from "@/convex/comments/client"
import {
  commentTargetRef,
  objectRefKey,
  type CommentTargetRef,
} from "@/convex/utils"

async function requireMessageInTarget(
  ctx: MutationCtx,
  messageId: string,
  target: CommentTargetRef
): Promise<void> {
  const message = await comments.getMessage(ctx, { messageId })
  if (message === null) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Comment not found" })
  }
  const thread = await comments.getThread(ctx, {
    threadId: message.message.threadId,
  })
  const zone =
    thread === null
      ? null
      : await comments.getZoneById(ctx, { zoneId: thread.zoneId })
  if (zone === null || zone.entityId !== objectRefKey(target)) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Comment not found" })
  }
}

export const add = mutation({
  args: {
    target: commentTargetRef,
    body: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { principal } = await requireCommentTargetRead(ctx, args.target)
    const body = args.body.trim()
    if (!body) throw new Error("Comment body is required")

    const zoneId = await comments.getOrCreateZone(ctx, {
      entityId: objectRefKey(args.target),
    })
    const threadId = await comments.getOrCreateThread(ctx, { zoneId })
    const { messageId, mentions } = await comments.addComment(ctx, {
      threadId,
      authorId: principal.userId,
      body,
    })

    const normalizedMentions = [
      ...new Set(
        mentions
          .map((mention) => ctx.db.normalizeId("users", mention.userId))
          .filter((id) => id !== null)
      ),
    ]
    const mentionedUserIds = await filterMentionableUserIds(
      ctx,
      args.target,
      normalizedMentions
    )

    await scheduleNotificationEvent(ctx, {
      kind: "commentAdded",
      target: args.target,
      actorId: principal.userId,
      body,
      mentionedUserIds,
    })

    return messageId
  },
})

export const edit = mutation({
  args: {
    target: commentTargetRef,
    messageId: v.string(),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { principal } = await requireCommentTargetRead(ctx, args.target)
    await requireMessageInTarget(ctx, args.messageId, args.target)
    const body = args.body.trim()
    if (!body) throw new Error("Comment body is required")

    await comments.editMessage(ctx, {
      messageId: args.messageId,
      body,
      authorId: principal.userId,
    })
    return null
  },
})

export const remove = mutation({
  args: {
    target: commentTargetRef,
    messageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { principal } = await requireCommentTargetRead(ctx, args.target)
    await requireMessageInTarget(ctx, args.messageId, args.target)
    const canModerate = canModerateComments(principal)

    await comments.deleteMessage(ctx, {
      messageId: args.messageId,
      authorId: canModerate ? undefined : principal.userId,
    })
    return null
  },
})

export const toggleReaction = mutation({
  args: {
    target: commentTargetRef,
    messageId: v.string(),
    emoji: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { principal } = await requireCommentTargetRead(ctx, args.target)
    await requireMessageInTarget(ctx, args.messageId, args.target)
    const emoji = normalizeEmoji(args.emoji)

    await comments.toggleReaction(ctx, {
      messageId: args.messageId,
      userId: principal.userId,
      emoji,
    })
    return null
  },
})
