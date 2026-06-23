import { ConvexError, v } from "convex/values"
import { mutation } from "@/convex/_generated/server"
import { requireCompetitionForManage } from "@/convex/competitions/access"
import {
  ORGANISER_INVITE_PATH,
  ORGANISER_INVITE_TTL_MS,
  MAX_ACTIVE_ORGANISER_INVITES,
} from "@/convex/competitions/invites/validators"
import { throwNotFound } from "@/convex/errors"
import { createToken, hashToken } from "@/convex/tokens"
import { mainSiteUrl } from "@/convex/urls"

export const create = mutation({
  args: {
    id: v.id("competitions"),
  },
  returns: v.object({
    url: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const { principal } = await requireCompetitionForManage(ctx, args.id)
    const now = Date.now()
    const activeInvites = await ctx.db
      .query("competitionOrganiserInvites")
      .withIndex("by_competitionId_and_revokedAt_and_expiresAt", (q) =>
        q
          .eq("competitionId", args.id)
          .eq("revokedAt", undefined)
          .gt("expiresAt", now)
      )
      .take(MAX_ACTIVE_ORGANISER_INVITES)
    if (activeInvites.length >= MAX_ACTIVE_ORGANISER_INVITES) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `A competition can have at most ${String(MAX_ACTIVE_ORGANISER_INVITES)} active organiser invite links.`,
      })
    }

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
      url: mainSiteUrl(
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
  },
})
