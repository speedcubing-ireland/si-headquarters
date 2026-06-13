import { v } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import { internalMutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import { findActiveInviteWithCompetition } from "@/convex/competitions/invites/model"

async function addOrganiserToCompetition(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  userId: Id<"users">
): Promise<void> {
  const competition = await ctx.db.get("competitions", competitionId)
  if (competition === null || competition.people.organisers.includes(userId)) {
    return
  }
  await ctx.db.patch("competitions", competitionId, {
    people: {
      ...competition.people,
      organisers: [...competition.people.organisers, userId],
    },
  })
}

/**
 * Sign-in gate for the WCA ConvexCredentials provider. WCA identity has
 * already been verified by the OAuth code exchange; this decides whether a
 * session may be created. Uninvited WCA accounts without an existing HQ
 * user are rejected.
 */
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

    let userId: Id<"users">
    if (existing === null) {
      // First sign-in must come through a valid invite link.
      if (inviteContext === null) {
        return null
      }
      userId = await ctx.db.insert("users", {
        wcaUserId: args.wcaUserId,
        name: args.name,
        email: args.email,
        image: args.avatarUrl,
      })
    } else {
      userId = existing._id
      await ctx.db.patch("users", userId, {
        name: args.name ?? existing.name,
        image: args.avatarUrl ?? existing.image,
      })
    }

    if (inviteContext !== null) {
      await addOrganiserToCompetition(
        ctx,
        inviteContext.competition._id,
        userId
      )
    }

    return { userId }
  },
})
