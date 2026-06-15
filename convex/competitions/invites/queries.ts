import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { requireCompetitionForManage } from "@/convex/competitions/access"
import { MAX_ACTIVE_ORGANISER_INVITES } from "@/convex/competitions/invites/validators"

export const list = query({
  args: {
    id: v.id("competitions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("competitionOrganiserInvites"),
      createdAt: v.number(),
      expiresAt: v.number(),
      createdByName: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    await requireCompetitionForManage(ctx, args.id)
    const invites = await ctx.db
      .query("competitionOrganiserInvites")
      .withIndex("by_competitionId_and_revokedAt_and_expiresAt", (q) =>
        q
          .eq("competitionId", args.id)
          .eq("revokedAt", undefined)
          .gt("expiresAt", Date.now())
      )
      .take(MAX_ACTIVE_ORGANISER_INVITES)
    invites.sort((left, right) => right.createdAt - left.createdAt)
    return Promise.all(
      invites.map(async (invite) => {
        const creator = await ctx.db.get("users", invite.createdByUserId)
        return {
          _id: invite._id,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          createdByName: creator?.name ?? creator?.email ?? "Unknown",
        }
      })
    )
  },
})
