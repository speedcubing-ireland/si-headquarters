import { v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"
import { findActiveInviteWithCompetition } from "@/convex/competitions/invites/model"

export const signInWithWca = internalMutation({
  args: {
    wcaUserId: v.number(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    inviteToken: v.optional(v.string()),
  },
  returns: v.union(v.object({ userId: v.id("users") }), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_wcaUserId", (q) => q.eq("wcaUserId", args.wcaUserId))
      .unique()
    if (existing?.disabled === true) {
      return null
    }

    const inviteContext =
      args.inviteToken === undefined
        ? null
        : await findActiveInviteWithCompetition(ctx, args.inviteToken)

    if (existing === null && inviteContext === null) {
      return null
    }

    const userId =
      existing === null
        ? await ctx.db.insert("users", {
            wcaUserId: args.wcaUserId,
            name: args.name,
            email: args.email,
            image: args.avatarUrl,
          })
        : existing._id

    if (existing !== null) {
      await ctx.db.patch("users", userId, {
        name: args.name ?? existing.name,
        image: args.avatarUrl ?? existing.image,
      })
    }

    if (
      inviteContext !== null &&
      !inviteContext.competition.people.organisers.includes(userId)
    ) {
      await ctx.db.patch("competitions", inviteContext.competition._id, {
        people: {
          ...inviteContext.competition.people,
          organisers: [...inviteContext.competition.people.organisers, userId],
        },
      })
    }

    return { userId }
  },
})
