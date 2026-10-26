import { v, type Infer } from "convex/values"
import { z } from "zod"
import { internal } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "@/convex/_generated/server"
import { isFeatureEnabled } from "@/config/lib/organisation"
import { localToday } from "@/convex/notifications/localTime"
import { mapWithConcurrency } from "@/convex/plugins/events/concurrency"
import { recordTag } from "@/convex/plugins/socialMedia/records/kinds"
import { WCA_URL } from "@/convex/plugins/socialMedia/records/links"
import {
  wcaRecordDocValidator,
  wcaRecordFields,
  type WcaRecord,
} from "@/convex/plugins/socialMedia/validators"

/** Far more live rows than a backlog of unposted competitions reaches. */
const MAX_PENDING_ROWS = 1000

/** Parallel competition lookups, gentle on the WCA's public API. */
const COMPETITION_LOOKUP_CONCURRENCY = 4

// The generated `CompetitionInfo` type omits `results_posted_at`, though the
// WCA returns it, so both responses are parsed here instead.
const competitionSchema = z.object({
  results_posted_at: z.string().nullable(),
})

const wcaResultSchema = z.object({
  round_id: z.number(),
  event_id: z.string(),
  name: z.string(),
  wca_id: z.string(),
  country_iso2: z.string(),
  best: z.number(),
  average: z.number(),
  /** "NR", "WR", or a continental code such as "ER"; null for no record. */
  regional_single_record: z.string().nullable(),
  regional_average_record: z.string().nullable(),
})

export type WcaResult = z.infer<typeof wcaResultSchema>

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

async function fetchWcaJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${WCA_URL}/api/v0${path}`, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(
      `WCA lookup of ${path} failed (HTTP ${String(response.status)}).`
    )
  }
  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error(`WCA lookup of ${path} returned an invalid response.`)
  }
  return parsed.data
}

/** The competition's results, or null while the WCA has not posted them. */
export async function fetchPostedResults(
  wcaCompetitionId: string
): Promise<WcaResult[] | null> {
  const path = `/competitions/${encodeURIComponent(wcaCompetitionId)}`
  const competition = await fetchWcaJson(path, competitionSchema)
  if (competition.results_posted_at === null) return null
  return await fetchWcaJson(`${path}/results`, z.array(wcaResultSchema))
}

/**
 * Checks a record WCA Live entered against the WCA's posted results: still a
 * record, with the WCA's tag, result and competitor, or no longer one.
 */
export function confirmRecord(
  record: WcaRecord,
  results: readonly WcaResult[]
): Confirmation {
  const eventResults = results.filter(
    (result) => result.event_id === record.eventId
  )
  // An event's rounds are created in order, so their ids sort the way WCA
  // Live numbers them.
  const roundIds = [...new Set(eventResults.map((result) => result.round_id))]
  roundIds.sort((a, b) => a - b)
  const roundId = roundIds.at(record.roundNumber - 1)
  const result = eventResults.find(
    (candidate) =>
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

export const applyConfirmations = internalMutation({
  args: {
    confirmations: v.array(
      v.object({
        id: v.id("wcaRecords"),
        confirmation: confirmationValidator,
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const { id, confirmation } of args.confirmations) {
      const row = await ctx.db.get("wcaRecords", id)
      // Gone or already settled since the action read it.
      if (row?.status !== "live") continue
      await ctx.db.patch("wcaRecords", id, confirmation)
    }
    return null
  },
})

/**
 * Cron entry point. Daily, as the WCA posts results days after a competition
 * and a record stays live until then. A competition whose lookup fails is left
 * for the next run, without holding up the others.
 */
export const confirm = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!isFeatureEnabled("records")) return null

    const pending = await ctx.runQuery(
      internal.plugins.socialMedia.records.confirm.pendingConfirmation,
      { endedBefore: localToday() }
    )
    const byCompetition = new Map<string, Doc<"wcaRecords">[]>()
    for (const record of pending) {
      const records = byCompetition.get(record.wcaCompetitionId) ?? []
      records.push(record)
      byCompetition.set(record.wcaCompetitionId, records)
    }

    await mapWithConcurrency(
      [...byCompetition],
      COMPETITION_LOOKUP_CONCURRENCY,
      async ([wcaCompetitionId, records]) => {
        try {
          const results = await fetchPostedResults(wcaCompetitionId)
          if (results === null) return
          await ctx.runMutation(
            internal.plugins.socialMedia.records.confirm.applyConfirmations,
            {
              confirmations: records.map((record) => ({
                id: record._id,
                confirmation: confirmRecord(record, results),
              })),
            }
          )
        } catch (error) {
          console.warn(
            `Records for ${wcaCompetitionId} could not be confirmed this run`,
            error
          )
        }
      }
    )
    return null
  },
})
