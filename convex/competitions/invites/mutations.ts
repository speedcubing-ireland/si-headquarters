import { v } from "convex/values"
import { mutation } from "@/convex/_generated/server"
import { requireCompetitionForManage } from "@/convex/competitions/access"
import {
  ORGANISER_INVITE_PATH,
  ORGANISER_INVITE_TTL_MS,
  organiserInviteLinkResultValidator,
} from "@/convex/competitions/invites/validators"
import { throwNotFound } from "@/convex/errors"
import { createToken, hashToken } from "@/convex/tokens"
import { hqSiteUrl } from "@/convex/urls"

export const create = mutation({
  args: {
    id: v.id("competitions"),
  },
  returns: organiserInviteLinkResultValidator,
  handler: async (ctx, args) => {
    const { principal } = await requireCompetitionForManage(ctx, args.id)
    const now = Date.now()
    const token = createToken()
    const expiresAt = now + ORGANISER_INVITE_TTL_MS
    await ctx.db.insert("competitionOrganiserInvites", {
      competitionId: args.id,
      tokenHash: await hashToken(token),
      createdByUserId: principal.userId,
      createdAt: now,
      expiresAt,
    })
    return {
      url: hqSiteUrl(
        `${ORGANISER_INVITE_PATH}?token=${encodeURIComponent(token)}`
      ),
      expiresAt,
    }
  },
})

export const revoke = mutation({
  args: {
    id: v.id("competitions"),
    inviteId: v.id("competitionOrganiserInvites"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCompetitionForManage(ctx, args.id)
    const invite = await ctx.db.get(
      "competitionOrganiserInvites",
      args.inviteId
    )
    if (invite === null || invite.competitionId !== args.id) {
      throwNotFound("Invite not found")
    }
    if (invite.revokedAt === undefined) {
      await ctx.db.patch("competitionOrganiserInvites", args.inviteId, {
        revokedAt: Date.now(),
      })
    }
    return null
  },
})
