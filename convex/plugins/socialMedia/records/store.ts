import { v } from "convex/values"
import type { Doc } from "@/convex/_generated/dataModel"
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "@/convex/_generated/server"
import {
  competitionCountryIso2,
  isFeatureEnabled,
} from "@/config/lib/organisation"
import { localDateOffset, localToday } from "@/convex/notifications/localTime"
import {
  RECENT_RECORDS_DAYS,
  syncRecentRecords,
} from "@/convex/plugins/socialMedia/records/collect"
import {
  wcaRecordDocValidator,
  wcaRecordValidator,
  type WcaRecord,
} from "@/convex/plugins/socialMedia/validators"

/** Far more rows than a few weeks of one country's records reach. */
const MAX_ROWS_PER_RANGE = 1000

/**
 * A stored record for the same result as `record`, whichever source it came
 * from: WCA Live and the WCA's history have different ids for one record. A
 * competitor can set the same record twice in an event, so the result is
 * compared too.
 */
export async function findSameRecord(
  ctx: QueryCtx,
  record: WcaRecord
): Promise<Doc<"wcaRecords"> | null> {
  for await (const row of ctx.db
    .query("wcaRecords")
    .withIndex("by_wcaCompetitionId_and_eventId", (q) =>
      q
        .eq("wcaCompetitionId", record.wcaCompetitionId)
        .eq("eventId", record.eventId)
    )) {
    if (
      row.type === record.type &&
      row.attemptResult === record.attemptResult &&
      // A newcomer only gets a WCA ID once the results are posted.
      (record.wcaId === null || row.wcaId === null
        ? row.personName === record.personName &&
          row.personCountryIso2 === record.personCountryIso2
        : row.wcaId === record.wcaId)
    ) {
      return row
    }
  }
  return null
}

/**
 * Upserts one sync's records by WCA Live's record id, and deletes stored records
 * WCA Live has since dropped — usually a corrected result — while their
 * competition is still well inside the feed's window. Records from competitions
 * that have aged out of the feed stay as they were last seen, and records the
 * WCA's posted results have settled are never touched again. A record already
 * imported from the WCA's history is not added a second time.
 */
export const saveSync = internalMutation({
  args: { records: v.array(wcaRecordValidator), syncedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seen = new Set<string>()
    for (const record of args.records) {
      seen.add(record.liveRecordId)
      const existing = await ctx.db
        .query("wcaRecords")
        .withIndex("by_liveRecordId", (q) =>
          q.eq("liveRecordId", record.liveRecordId)
        )
        .unique()
      if (existing === null) {
        // A live match is one WCA Live re-entered under a new id, which the
        // pruning below drops, so only a settled match stands in for it.
        const same = await findSameRecord(ctx, record)
        if (same === null || same.status === "live") {
          await ctx.db.insert("wcaRecords", record)
        }
      } else if (existing.status === "live") {
        await ctx.db.replace("wcaRecords", existing._id, record)
      }
    }

    // A day short of the feed's reach, so a competition on its edge is never
    // mistaken for a withdrawn record.
    const feedFrom = localDateOffset(
      localToday(args.syncedAt),
      -(RECENT_RECORDS_DAYS - 1)
    )
    // A competition ends on or after it starts, so this range holds every
    // competition that started from `feedFrom`.
    const recent = await ctx.db
      .query("wcaRecords")
      .withIndex("by_competitionEndDate", (q) =>
        q.gte("competitionEndDate", feedFrom)
      )
      .take(MAX_ROWS_PER_RANGE)
    for (const row of recent) {
      if (
        row.status === "live" &&
        row.competitionStartDate >= feedFrom &&
        !seen.has(row.liveRecordId)
      ) {
        await ctx.db.delete("wcaRecords", row._id)
      }
    }
    return null
  },
})

/**
 * Records set by the organisation's competitors at competitions that ended in
 * the week starting on `weekStart`, leaving out any the WCA's posted results
 * dropped: what the weekly email reports.
 */
export const forWeek = internalQuery({
  args: { weekStart: v.string() },
  returns: v.array(wcaRecordDocValidator),
  handler: async (ctx, args) => {
    const countryIso2 = competitionCountryIso2()
    const rows = await ctx.db
      .query("wcaRecords")
      .withIndex("by_competitionEndDate", (q) =>
        q
          .gte("competitionEndDate", args.weekStart)
          .lt("competitionEndDate", localDateOffset(args.weekStart, 7))
      )
      .take(MAX_ROWS_PER_RANGE)
    return rows.filter(
      (row) =>
        row.personCountryIso2 === countryIso2 && row.status !== "notRecord"
    )
  },
})

/**
 * Cron entry point. Hourly, so the records page keeps up through a competition
 * weekend; failures are left to the next tick.
 */
export const sync = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!isFeatureEnabled("records")) return null
    await syncRecentRecords(ctx)
    return null
  },
})
