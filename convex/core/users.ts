import { ConvexError, v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"
import { mutation, query } from "../_generated/server"
import { requireUserId } from "./auth"

const MAX_NAME_LENGTH = 80
const DEFAULT_AVATAR_URL = "/avatars/default.svg"

function avatarUrl(user: { image?: string }): string {
  return user.image ?? DEFAULT_AVATAR_URL
}

function sanitizeName(name: string): string {
  const nextName = name.trim()
  if (!nextName) throw new ConvexError("Name cannot be empty.")
  if (nextName.length > MAX_NAME_LENGTH) {
    throw new ConvexError("Name is too long.")
  }
  return nextName
}

export const appUserShape = v.object({
  id: v.id("users"),
  name: v.string(),
  avatarUrl: v.string(),
})

export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      avatarUrl: v.string(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const user = await ctx.db.get(userId)
    if (!user) return null
    return {
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      email: user.email,
      avatarUrl: avatarUrl(user),
    }
  },
})

export const listUsers = query({
  args: {},
  returns: v.array(appUserShape),
  handler: async (ctx) => {
    await requireUserId(ctx)
    const users = await ctx.db.query("users").withIndex("email").collect()
    return users.map((user) => ({
      id: user._id,
      name: user.name ?? "",
      avatarUrl: avatarUrl(user),
    }))
  },
})

export const updateCurrentUserName = mutation({
  args: {
    name: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const name = sanitizeName(args.name)
    await ctx.db.patch(userId, { name })
    return name
  },
})
