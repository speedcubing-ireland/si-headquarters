import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { requireCompetitionForManage } from "@/convex/competitions/access"
import { isInviteActive } from "@/convex/competitions/invites/model"
import { organiserInviteSummaryValidator } from "@/convex/competitions/invites/validators"

const MAX_INVITES = 50

export const list = query({
  args: {
    id: v.id("competitions"),
  },
  returns: v.array(organiserInviteSummaryValidator),
  handler: async (ctx, args) => {
    await requireCompetitionForManage(ctx, args.id)
    const invites = await ctx.db
      .query("competitionOrganiserInvites")
      .withIndex("by_competitionId", (q) => q.eq("competitionId", args.id))
      .order("desc")
      .take(MAX_INVITES)
    const now = Date.now()
    const active = invites.filter((invite) => isInviteActive(invite, now))
    return await Promise.all(
      active.map(async (invite) => {
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
