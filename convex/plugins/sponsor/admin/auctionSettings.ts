import { ConvexError, v } from "convex/values"
import { mutation, query } from "@/convex/_generated/server"
import { requireSponsorPortalAdmin } from "@/convex/permissions/principal"

const SETTINGS_KEY = "default"
export const DEFAULT_START_DELAY_HOURS = 1
export const DEFAULT_DURATION_HOURS = 1

export const get = query({
  args: {},
  returns: v.object({
    startDelayHours: v.number(),
    durationHours: v.number(),
  }),
  handler: async (ctx) => {
    await requireSponsorPortalAdmin(ctx)
    const row = await ctx.db
      .query("sponsorshipAuctionSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique()
    return {
      startDelayHours: row?.startDelayHours ?? DEFAULT_START_DELAY_HOURS,
      durationHours: row?.durationHours ?? DEFAULT_DURATION_HOURS,
    }
  },
})

export const update = mutation({
  args: {
    startDelayHours: v.number(),
    durationHours: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorId = await requireSponsorPortalAdmin(ctx)

    if (!Number.isInteger(args.startDelayHours) || args.startDelayHours < 1) {
      throw new ConvexError(
        "Start delay must be a positive whole number of hours."
      )
    }
    if (!Number.isInteger(args.durationHours) || args.durationHours < 1) {
      throw new ConvexError(
        "Duration must be a positive whole number of hours."
      )
    }

    const now = Date.now()
    const existing = await ctx.db
      .query("sponsorshipAuctionSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique()

    if (existing === null) {
      await ctx.db.insert("sponsorshipAuctionSettings", {
        key: SETTINGS_KEY,
        startDelayHours: args.startDelayHours,
        durationHours: args.durationHours,
        updatedById: actorId,
        updatedAt: now,
      })
    } else {
      await ctx.db.patch("sponsorshipAuctionSettings", existing._id, {
        startDelayHours: args.startDelayHours,
        durationHours: args.durationHours,
        updatedById: actorId,
        updatedAt: now,
      })
    }

    return null
  },
})
