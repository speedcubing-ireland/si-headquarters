import { mutation } from "@/convex/_generated/server"
import {
  requireDirector,
  requireUserManagement,
} from "@/convex/permissions/principal"
import {
  addTeamMember,
  isApplicationTeam,
  removeTeamMember,
} from "@/convex/teams/model"
import { TEAM_SIDEBAR_PAGES, teamSidebarPage } from "@/convex/teams/validators"
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

export const setSidebarPageEnabled = mutation({
  args: {
    teamId: v.id("teams"),
    page: teamSidebarPage,
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireDirector(ctx)
    const team = await ctx.db.get("teams", args.teamId)
    if (team === null || !isApplicationTeam(team.name)) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Team not found",
      })
    }

    const disabledPages = new Set(team.disabledSidebarPages ?? [])
    if (args.enabled) {
      disabledPages.delete(args.page)
    } else {
      disabledPages.add(args.page)
    }

    await ctx.db.patch("teams", args.teamId, {
      disabledSidebarPages: TEAM_SIDEBAR_PAGES.filter((page) =>
        disabledPages.has(page)
      ),
    })
    return null
  },
})
