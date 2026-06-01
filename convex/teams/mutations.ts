import { mutation } from "@/convex/_generated/server"
import { requireUserManagement } from "@/convex/permissions/principal"
import {
  addTeamMember,
  removeTeamMember,
} from "@/convex/teams/model"
import { ConvexError, v } from "convex/values"

export const addMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireUserManagement(ctx)
    const [team, user] = await Promise.all([
      ctx.db.get("teams", args.teamId),
      ctx.db.get("users", args.userId),
    ])
    if (team === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Team not found",
      })
    }
    if (user === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      })
    }
    await addTeamMember(ctx, args.teamId, args.userId)
    return null
  },
})

export const removeMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireUserManagement(ctx)
    const team = await ctx.db.get("teams", args.teamId)
    if (team === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Team not found",
      })
    }
    await removeTeamMember(ctx, args.teamId, args.userId)
    return null
  },
})
