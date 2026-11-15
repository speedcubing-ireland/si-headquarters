import { v, type Infer } from "convex/values"
import { internal } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "@/convex/_generated/server"
import {
  competitionCountryIso2,
  isFeatureEnabled,
} from "@/config/lib/organisation"
import { localDateOffset, localToday } from "@/convex/notifications/localTime"
import { mapWithConcurrency } from "@/convex/plugins/events/concurrency"
import {
  RECORD_TYPES,
  recordTag,
} from "@/convex/plugins/socialMedia/records/kinds"
import { findSameRecord } from "@/convex/plugins/socialMedia/records/store"
import {
  fetchCompetition,
  fetchResults,
  listCompetitions,
  type WcaCompetition,
  type WcaResult,
} from "@/convex/plugins/socialMedia/records/wcaResults"
import {
  wcaRecordDocValidator,
  wcaRecordFields,
  wcaRecordScanFields,
  wcaRecordValidator,
  type WcaRecord,
} from "@/convex/plugins/socialMedia/validators"

export type { WcaResult } from "@/convex/plugins/socialMedia/records/wcaResults"

/** Far more live rows than a backlog of unposted competitions reaches. */
const MAX_PENDING_ROWS = 1000

/** Far more competitions than the scan's window holds worldwide. */
const MAX_SCAN_ROWS = 5000

/** Parallel competition lookups, gentle on the WCA's public API. */
const COMPETITION_LOOKUP_CONCURRENCY = 4

/**
 * Competitions read per run, so a run stays well inside an action's time limit;
 * the rest wait for the next run. A week posts far fewer worldwide than a few
 * runs read, so only the first run after deploying works through a backlog.
 */
const MAX_COMPETITIONS_PER_RUN = 40

/**
 * How far back, by start date, competitions are scanned for posted results.
 * The WCA usually posts within days; this leaves weeks for a late posting.
 */
export const POSTED_RESULTS_SCAN_DAYS = 60

/** What the WCA's posted results say about one stored record. */
export const confirmationValidator = v.union(
  v.object({
    status: v.literal("confirmed"),
    tag: wcaRecordFields.tag,
    attemptResult: v.number(),
    wcaId: v.string(),
    personName: v.string(),
  }),
  v.object({ status: v.literal("notRecord") })
)

export type Confirmation = Infer<typeof confirmationValidator>

/**
 * An event's round ids in order: rounds are created in order, so their ids
 * sort the way WCA Live numbers them.
 */
function eventRoundIds(
  results: readonly WcaResult[],
  eventId: string
): number[] {
  const roundIds = [
    ...new Set(
      results
        .filter((result) => result.event_id === eventId)
        .map((result) => result.round_id)
    ),
  ]
  return roundIds.sort((a, b) => a - b)
}

/**
 * Checks a record WCA Live entered against the WCA's posted results: still a
 * record, with the WCA's tag, result and competitor, or no longer one.
 */
export function confirmRecord(
  record: WcaRecord,
  results: readonly WcaResult[]
): Confirmation {
  const roundId = eventRoundIds(results, record.eventId).at(
    record.roundNumber - 1
  )
  const result = results.find(
    (candidate) =>
      candidate.event_id === record.eventId &&
      candidate.round_id === roundId &&
      // A newcomer only gets a WCA ID once the results are posted.
      (record.wcaId === null
        ? candidate.name === record.personName &&
          candidate.country_iso2 === record.personCountryIso2
        : candidate.wca_id === record.wcaId)
  )
  if (result === undefined) return { status: "notRecord" }

  const marker =
    record.type === "single"
      ? result.regional_single_record
      : result.regional_average_record
  if (marker === null) return { status: "notRecord" }
  return {
    status: "confirmed",
    tag: recordTag(marker),
    attemptResult: record.type === "single" ? result.best : result.average,
    wcaId: result.wca_id,
    personName: result.name,
  }
}

/** The WCA's round types, worded as WCA Live names rounds. */
const ROUND_NAMES: Partial<Record<string, string>> = {
  "0": "Qualification Round",
  h: "Qualification Round",
  "1": "First Round",
  d: "First Round",
  "2": "Second Round",
  e: "Second Round",
  "3": "Semi Final",
  g: "Semi Final",
  b: "B Final",
  c: "Final",
  f: "Final",
}

/**
 * The records in a competition's posted results worth keeping: those set by
 * competitors from `countryIso2`, or set at a competition held there. Rounds
 * are numbered as `confirmRecord` reads them, so the two always agree.
 */
export function toPostedRecords(
  results: readonly WcaResult[],
  competition: WcaCompetition,
  countryIso2: string
): WcaRecord[] {
  const heldHere = competition.country_iso2 === countryIso2
  const roundIdsByEvent = new Map<string, number[]>()
  const roundNumber = (result: WcaResult) => {
    let roundIds = roundIdsByEvent.get(result.event_id)
    if (roundIds === undefined) {
      roundIds = eventRoundIds(results, result.event_id)
      roundIdsByEvent.set(result.event_id, roundIds)
    }
    return roundIds.indexOf(result.round_id) + 1
  }
  const records: WcaRecord[] = []
  for (const result of results) {
    if (!heldHere && result.country_iso2 !== countryIso2) continue
    for (const type of RECORD_TYPES) {
      const marker =
        type === "single"
          ? result.regional_single_record
          : result.regional_average_record
      if (marker === null) continue
      const roundName = ROUND_NAMES[result.round_type_id]
      if (roundName === undefined) {
        throw new Error(
          `Unknown round type "${result.round_type_id}" for result ${String(result.id)}.`
        )
      }
      records.push({
        liveRecordId: `wca:${String(result.id)}:${type}`,
        status: "confirmed",
        tag: recordTag(marker),
        type,
        attemptResult: type === "single" ? result.best : result.average,
        eventId: result.event_id,
        roundName,
        roundNumber: roundNumber(result),
        personName: result.name,
        wcaId: result.wca_id,
        personCountryIso2: result.country_iso2,
        liveCompetitionId: null,
        wcaCompetitionId: competition.id,
        competitionName: competition.name,
        competitionStartDate: competition.start_date,
        competitionEndDate: competition.end_date,
      })
    }
  }
  return records
}

/** Records still as WCA Live entered them, from competitions that have ended. */
export const pendingConfirmation = internalQuery({
  args: { endedBefore: v.string() },
  returns: v.array(wcaRecordDocValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("wcaRecords")
      .withIndex("by_status_and_competitionEndDate", (q) =>
        q.eq("status", "live").lt("competitionEndDate", args.endedBefore)
      )
      .take(MAX_PENDING_ROWS)
  },
})

/** The competitions already scanned, by WCA id, with when results were posted. */
export const scannedCompetitions = internalQuery({
  args: {},
  returns: v.record(v.string(), v.string()),
  handler: async (ctx) => {
    const scans = await ctx.db.query("wcaRecordScans").take(MAX_SCAN_ROWS)
    return Object.fromEntries(
      scans.map((scan) => [scan.wcaCompetitionId, scan.resultsPostedAt])
    )
  },
})

/**
 * Settles one competition from its posted results, in one transaction: its
 * live records are confirmed or dropped, then the records nobody stored yet
 * are added, and the competition is marked scanned. A record already stored,
 * from WCA Live (just confirmed above), an earlier scan or the history import,
 * is not added again.
 */
export const applyPostedResults = internalMutation({
  args: {
    scan: v.object(wcaRecordScanFields),
    confirmations: v.array(
      v.object({
        id: v.id("wcaRecords"),
        confirmation: confirmationValidator,
      })
    ),
    records: v.array(wcaRecordValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const confirmedAt = Date.now()
    for (const { id, confirmation } of args.confirmations) {
      const row = await ctx.db.get("wcaRecords", id)
      // Gone or already settled since the action read it.
      if (row?.status !== "live") continue
      await ctx.db.patch(
        "wcaRecords",
        id,
        confirmation.status === "confirmed"
          ? { ...confirmation, confirmedAt }
          : confirmation
      )
    }

    for (const record of args.records) {
      const existing =
        (await ctx.db
          .query("wcaRecords")
          .withIndex("by_liveRecordId", (q) =>
            q.eq("liveRecordId", record.liveRecordId)
          )
          .unique()) ?? (await findSameRecord(ctx, record))
      if (existing === null) {
        await ctx.db.insert("wcaRecords", { ...record, confirmedAt })
      }
    }

    const scan = await ctx.db
      .query("wcaRecordScans")
      .withIndex("by_wcaCompetitionId", (q) =>
        q.eq("wcaCompetitionId", args.scan.wcaCompetitionId)
      )
      .unique()
    if (scan === null) {
      await ctx.db.insert("wcaRecordScans", args.scan)
    } else {
      await ctx.db.replace("wcaRecordScans", scan._id, args.scan)
    }
    return null
  },
})

/** Deletes the scan marks of competitions that ended before `endedBefore`. */
export const pruneScans = internalMutation({
  args: { endedBefore: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stale = await ctx.db
      .query("wcaRecordScans")
      .withIndex("by_competitionEndDate", (q) =>
        q.lt("competitionEndDate", args.endedBefore)
      )
      .take(MAX_SCAN_ROWS)
    for (const scan of stale) await ctx.db.delete("wcaRecordScans", scan._id)
    return null
  },
})

/**
 * Reads the posted results of every competition that needs it: those with
 * records still as WCA Live entered them, and those of the last
 * `POSTED_RESULTS_SCAN_DAYS`, worldwide and however they were scored, that the
 * WCA posted since they were last read. Each is settled with
 * `applyPostedResults`, up to `MAX_COMPETITIONS_PER_RUN`, the ones that matter
 * most first. A competition whose lookup fails is left for the next run,
 * without holding up the others; failing to list competitions throws.
 */
export async function settlePostedResults(ctx: ActionCtx): Promise<void> {
  const today = localToday()
  const scanFrom = localDateOffset(today, -POSTED_RESULTS_SCAN_DAYS)

  const [pending, scanned, listed] = await Promise.all([
    ctx.runQuery(
      internal.plugins.socialMedia.records.confirm.pendingConfirmation,
      { endedBefore: today }
    ),
    ctx.runQuery(
      internal.plugins.socialMedia.records.confirm.scannedCompetitions,
      {}
    ),
    listCompetitions(scanFrom, today),
  ])

  const pendingByCompetition = new Map<string, Doc<"wcaRecords">[]>()
  for (const record of pending) {
    const records = pendingByCompetition.get(record.wcaCompetitionId) ?? []
    records.push(record)
    pendingByCompetition.set(record.wcaCompetitionId, records)
  }

  const countryIso2 = competitionCountryIso2()
  // Null for a competition with pending records the listing does not reach,
  // looked up on its own.
  const toRead: [string, WcaCompetition | null][] = []
  const listedIds = new Set(listed.map((competition) => competition.id))
  for (const wcaCompetitionId of pendingByCompetition.keys()) {
    if (!listedIds.has(wcaCompetitionId)) toRead.push([wcaCompetitionId, null])
  }
  const postedSinceRead = listed.filter(
    (competition) =>
      competition.results_posted_at !== null &&
      competition.cancelled_at === null &&
      (scanned[competition.id] !== competition.results_posted_at ||
        pendingByCompetition.has(competition.id))
  )
  // Records already shown as provisional first, then the country's own
  // competitions, then the most recent.
  const priority = (competition: WcaCompetition) =>
    pendingByCompetition.has(competition.id)
      ? 0
      : competition.country_iso2 === countryIso2
        ? 1
        : 2
  postedSinceRead.sort(
    (a, b) => priority(a) - priority(b) || b.end_date.localeCompare(a.end_date)
  )
  for (const competition of postedSinceRead) {
    toRead.push([competition.id, competition])
  }

  await mapWithConcurrency(
    toRead.slice(0, MAX_COMPETITIONS_PER_RUN),
    COMPETITION_LOOKUP_CONCURRENCY,
    async ([wcaCompetitionId, listedCompetition]) => {
      try {
        const competition =
          listedCompetition ?? (await fetchCompetition(wcaCompetitionId))
        if (competition.results_posted_at === null) return
        const results = await fetchResults(wcaCompetitionId)
        await ctx.runMutation(
          internal.plugins.socialMedia.records.confirm.applyPostedResults,
          {
            scan: {
              wcaCompetitionId,
              resultsPostedAt: competition.results_posted_at,
              competitionEndDate: competition.end_date,
              scannedAt: Date.now(),
            },
            confirmations: (
              pendingByCompetition.get(wcaCompetitionId) ?? []
            ).map((record) => ({
              id: record._id,
              confirmation: confirmRecord(record, results),
            })),
            records: toPostedRecords(results, competition, countryIso2),
          }
        )
      } catch (error) {
        console.warn(
          `Posted results of ${wcaCompetitionId} could not be read this run`,
          error
        )
      }
    }
  )

  await ctx.runMutation(
    internal.plugins.socialMedia.records.confirm.pruneScans,
    { endedBefore: scanFrom }
  )
}

/**
 * Cron entry point. Every few hours: the WCA posts results days after a
 * competition scored on WCA Live, but often the same evening for one scored
 * with the WCA's own live results.
 */
export const confirm = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!isFeatureEnabled("records")) return null
    await settlePostedResults(ctx)
    return null
  },
})
