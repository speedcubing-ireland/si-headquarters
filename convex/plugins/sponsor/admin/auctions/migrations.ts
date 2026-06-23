import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalMutation } from "@/convex/_generated/server"

/**
 * One-off backfill: stamp legacy auctions (created before the `subjectKind`
 * field existed) as `hq_competition`. resolveAuctionSubject already defaults
 * undefined to `hq_competition`, so this is purely to make the stored data
 * explicit. Run once from the dashboard: it self-schedules through every page.
 */
export const backfillAuctionSubjects = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    patched: v.number(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("sponsorshipAuctions")
      .paginate({ numItems: 100, cursor: args.cursor ?? null })

    let patched = 0
    for (const auction of page.page) {
      if (auction.subjectKind === undefined) {
        await ctx.db.patch("sponsorshipAuctions", auction._id, {
          subjectKind: "hq_competition",
        })
        patched++
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.plugins.sponsor.admin.auctions.migrations
          .backfillAuctionSubjects,
        { cursor: page.continueCursor }
      )
    }

    return {
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      patched,
    }
  },
})
