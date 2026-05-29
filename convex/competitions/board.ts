import { query } from "@/convex/_generated/server"
import { requireUserId } from "@/convex/lib/requireUser"
import { v } from "convex/values"

/** Minimal competition list for task filters and selectors. */
export const listForBoard = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("competitions"),
      name: v.string(),
    })
  ),
  handler: async (ctx) => {
    await requireUserId(ctx)

    const competitions = await ctx.db.query("competitions").collect()
    return competitions.map((competition) => ({
      _id: competition._id,
      name: competition.name,
    }))
  },
})
