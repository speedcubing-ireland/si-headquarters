import { query } from "@/convex/_generated/server"
import { publicUserValidator, toPublicUser } from "@/convex/users/validators"
import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

export const list = query({
  args: {},
  returns: v.array(publicUserValidator),
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx)
    if (!authUserId) throw new Error("Authentication required")

    const users = await ctx.db.query("users").take(50)

    return users.map(toPublicUser)
  },
})
