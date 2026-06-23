import type { Doc, Id } from "@/convex/_generated/dataModel"
import { mutation, type MutationCtx } from "@/convex/_generated/server"
import { requireUserManagement } from "@/convex/permissions/principal"
import type { AdminDiscordUpdate } from "@/convex/users/validators"
import { adminDiscordUpdateValidator } from "@/convex/users/validators"
import { ConvexError, v } from "convex/values"

function notFound(message: string): never {
  throw new ConvexError({
    code: "NOT_FOUND",
    message,
  })
}

async function assertDiscordAvailable(
  ctx: MutationCtx,
  userId: Id<"users">,
  discordUserId: string
) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_discordUserId", (q) => q.eq("discordUserId", discordUserId))
    .unique()
  if (existing !== null && existing._id !== userId) {
    throw new ConvexError({
      code: "CONFLICT",
      message: "This Discord account is already linked to another user.",
    })
  }
}

function buildUserProfilePatch(
  user: Doc<"users">,
  args: {
    disabled: boolean
    discord: AdminDiscordUpdate
    actorId: Id<"users">
  }
): Partial<Doc<"users">> | null {
  const disabledChanged = (user.disabled === true) !== args.disabled
  const patch: Partial<Doc<"users">> = { disabled: args.disabled }

  switch (args.discord.kind) {
    case "link":
      return {
        ...patch,
        discordUserId: args.discord.member.discordUserId,
        discordUsername: args.discord.member.discordUsername,
        discordDisplayName: args.discord.member.discordDisplayName,
        discordAvatarHash: args.discord.member.discordAvatarHash,
        discordLinkedAt: Date.now(),
        discordLinkedBy: args.actorId,
      }
    case "unlink":
      return {
        ...patch,
        discordUserId: undefined,
        discordUsername: undefined,
        discordDisplayName: undefined,
        discordAvatarHash: undefined,
        discordLinkedAt: undefined,
        discordLinkedBy: undefined,
      }
    case "unchanged":
      return disabledChanged ? patch : null
  }
}

export const createForAdmin = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    wcaUserId: v.optional(v.number()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    await requireUserManagement(ctx)
    if (args.email === undefined && args.wcaUserId === undefined) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "An email or WCA User ID is required.",
      })
    }
    if (args.email !== undefined) {
      const existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", args.email))
        .unique()
      if (existing !== null) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "A user with this email already exists.",
        })
      }
    }
    if (args.wcaUserId !== undefined) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_wcaUserId", (q) => q.eq("wcaUserId", args.wcaUserId))
        .unique()
      if (existing !== null) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "A user with this WCA ID already exists.",
        })
      }
    }
    return ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      wcaUserId: args.wcaUserId,
    })
  },
})

export const updateForAdmin = mutation({
  args: {
    userId: v.id("users"),
    disabled: v.boolean(),
    teamIds: v.array(v.id("teams")),
    discord: adminDiscordUpdateValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorId = await requireUserManagement(ctx)
    if (args.disabled && args.userId === actorId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You cannot disable your own account.",
      })
    }

    const [user, existingMemberships] = await Promise.all([
      ctx.db.get("users", args.userId),
      ctx.db
        .query("teamMemberships")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect(),
    ])
    if (user === null) {
      notFound("User not found")
    }

    const desiredTeamIds = new Set(args.teamIds)
    const teams = await Promise.all(
      [...desiredTeamIds].map((teamId) => ctx.db.get("teams", teamId))
    )
    if (teams.some((team) => team === null)) {
      notFound("Team not found")
    }

    if (args.discord.kind === "link") {
      await assertDiscordAvailable(
        ctx,
        args.userId,
        args.discord.member.discordUserId
      )
    }

    const userPatch = buildUserProfilePatch(user, {
      disabled: args.disabled,
      discord: args.discord,
      actorId,
    })
    if (userPatch !== null) {
      await ctx.db.patch("users", args.userId, userPatch)
    }

    const currentTeamIds = new Set(
      existingMemberships.map((membership) => membership.teamId)
    )
    await Promise.all([
      ...[...desiredTeamIds]
        .filter((teamId) => !currentTeamIds.has(teamId))
        .map((teamId) =>
          ctx.db.insert("teamMemberships", { teamId, userId: args.userId })
        ),
      ...existingMemberships
        .filter((membership) => !desiredTeamIds.has(membership.teamId))
        .map((membership) => ctx.db.delete("teamMemberships", membership._id)),
    ])
    return null
  },
})
