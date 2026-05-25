import { query, type QueryCtx } from "@/convex/_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel";
import { publicUserValidator, type PublicUser } from "./validators";

export function toPublicUser(
  user: Pick<Doc<"users">, "_id" | "name" | "image">
): PublicUser {
  return {
    _id: user._id,
    name: user.name,
    image: user.image,
  }
}

export async function getPublicUser(
  ctx: QueryCtx,
  userId: Id<"users"> | null
): Promise<PublicUser | null> {
  if (!userId) return null

  const user = await ctx.db.get(userId)
  return user ? toPublicUser(user) : null
}

export async function getPublicUsers(
  ctx: QueryCtx,
  userIds: Id<"users">[]
): Promise<PublicUser[]> {
  const users = await Promise.all(userIds.map((userId) => ctx.db.get(userId)))
  return users
    .filter((user): user is Doc<"users"> => user !== null)
    .map(toPublicUser)
}

export const list = query({
  args: {},
  returns: v.array(publicUserValidator),
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx)
    if (!authUserId) throw new Error("Authentication required")

    const users = await ctx.db.query("users").collect()

    return users.map(toPublicUser)
  },
})
