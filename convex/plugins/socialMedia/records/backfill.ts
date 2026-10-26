import { v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"
import { findSameRecord } from "@/convex/plugins/socialMedia/records/store"
import { wcaRecordValidator } from "@/convex/plugins/socialMedia/validators"

/**
 * Adds records from the WCA's records history, parsed by `toHistoryRecords`.
 * Run through `scripts/backfill-records.ts`, which sends the file in chunks.
 *
 * A record already stored, imported before or confirmed from WCA Live, is
 * skipped, so re-running is safe. Imported records are already `confirmed`, so
 * the sync and the daily confirmation leave them alone.
 */
export const importHistory = internalMutation({
  args: {
    records: v.array(wcaRecordValidator),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({ inserted: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    let inserted = 0
    let skipped = 0
    for (const record of args.records) {
      const existing =
        (await ctx.db
          .query("wcaRecords")
          .withIndex("by_liveRecordId", (q) =>
            q.eq("liveRecordId", record.liveRecordId)
          )
          .unique()) ?? (await findSameRecord(ctx, record))
      if (existing !== null) {
        skipped++
        continue
      }
      if (args.dryRun !== true) await ctx.db.insert("wcaRecords", record)
      inserted++
    }
    return { inserted, skipped }
  },
})
