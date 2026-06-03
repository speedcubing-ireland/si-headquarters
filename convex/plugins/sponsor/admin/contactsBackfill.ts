import { v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"
import {
  getPrimaryContact,
  insertPrimaryContact,
} from "@/convex/plugins/sponsor/lib/contacts"

/** Backfill one primary contact per sponsor that has none. Safe to run repeatedly. */
export const backfillPrimaryContacts = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    created: v.number(),
    nextCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 50
    const sponsors = await ctx.db.query("sponsors").paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    })
    let created = 0

    for (const sponsor of sponsors.page) {
      const existing = await getPrimaryContact(ctx, sponsor._id)
      if (existing) continue
      await insertPrimaryContact(ctx, {
        sponsor,
        actorId: sponsor.updatedById,
      })
      created += 1
    }

    return {
      processed: sponsors.page.length,
      created,
      nextCursor: sponsors.isDone ? null : sponsors.continueCursor,
    }
  },
})
