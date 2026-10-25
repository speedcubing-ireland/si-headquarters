import { z } from "zod"
import { internal } from "@/convex/_generated/api"
import type { ActionCtx } from "@/convex/_generated/server"
import { competitionCountryIso2 } from "@/config/lib/organisation"
import { wcaEventOrder } from "@/convex/plugins/wca/eventLabels"
import { WCA_LIVE_URL } from "@/convex/plugins/socialMedia/records/links"
import {
  RECORD_TAGS,
  RECORD_TYPES,
} from "@/convex/plugins/socialMedia/records/kinds"
import type { WcaRecord } from "@/convex/plugins/socialMedia/validators"

/** How far back, by competition start date, WCA Live's recent records reach. */
export const RECENT_RECORDS_DAYS = 10

/**
 * The records WCA Live shows as "Recent records": every WR, CR and NR from
 * competitions that started in the last 10 days, worldwide.
 */
const RECENT_RECORDS_QUERY = `{
  recentRecords {
    id
    tag
    type
    attemptResult
    result {
      person { name wcaId country { iso2 } }
      round {
        name
        number
        competitionEvent {
          event { id }
          competition {
            id
            wcaId
            name
            startDate
            endDate
            venues { country { iso2 } }
          }
        }
      }
    }
  }
}`

const recentRecordSchema = z.object({
  id: z.string(),
  tag: z.enum(RECORD_TAGS),
  type: z.enum(RECORD_TYPES),
  attemptResult: z.number(),
  result: z.object({
    person: z.object({
      name: z.string(),
      wcaId: z.string().nullable(),
      country: z.object({ iso2: z.string() }),
    }),
    round: z.object({
      name: z.string(),
      number: z.number(),
      competitionEvent: z.object({
        event: z.object({ id: z.string() }),
        competition: z.object({
          id: z.string(),
          wcaId: z.string(),
          name: z.string(),
          startDate: z.string(),
          endDate: z.string(),
          venues: z.array(
            z.object({ country: z.object({ iso2: z.string() }) })
          ),
        }),
      }),
    }),
  }),
})

const recentRecordsResponseSchema = z.object({
  data: z.object({ recentRecords: z.array(recentRecordSchema) }),
})

export type RecentRecord = z.infer<typeof recentRecordSchema>

export interface CompetitionRecords<R extends WcaRecord = WcaRecord> {
  liveCompetitionId: string
  wcaCompetitionId: string
  competitionName: string
  competitionEndDate: string
  records: R[]
}

export async function fetchRecentRecords(): Promise<RecentRecord[]> {
  const response = await fetch(`${WCA_LIVE_URL}/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: RECENT_RECORDS_QUERY }),
  })
  if (!response.ok) {
    throw new Error(
      `WCA Live recent records lookup failed (HTTP ${String(response.status)}).`
    )
  }
  // GraphQL reports errors with a 200 and no `data`, which fails the parse.
  const parsed = recentRecordsResponseSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error(
      "WCA Live recent records lookup returned an invalid response."
    )
  }
  return parsed.data.data.recentRecords
}

/**
 * The feed's records worth keeping: those set by competitors from
 * `countryIso2`, or set at a competition with a venue there.
 */
export function toStoredRecords(
  feed: readonly RecentRecord[],
  countryIso2: string
): WcaRecord[] {
  return feed
    .filter(
      ({ result }) =>
        result.person.country.iso2 === countryIso2 ||
        result.round.competitionEvent.competition.venues.some(
          (venue) => venue.country.iso2 === countryIso2
        )
    )
    .map(({ id, tag, type, attemptResult, result }) => {
      const { person, round } = result
      const { competition, event } = round.competitionEvent
      return {
        liveRecordId: id,
        tag,
        type,
        attemptResult,
        eventId: event.id,
        roundName: round.name,
        roundNumber: round.number,
        personName: person.name,
        wcaId: person.wcaId,
        personCountryIso2: person.country.iso2,
        liveCompetitionId: competition.id,
        wcaCompetitionId: competition.wcaId,
        competitionName: competition.name,
        competitionStartDate: competition.startDate,
        competitionEndDate: competition.endDate,
      }
    })
}

/** Saves WCA Live's current recent records for the organisation's country. */
export async function syncRecentRecords(ctx: ActionCtx): Promise<void> {
  const records = toStoredRecords(
    await fetchRecentRecords(),
    competitionCountryIso2()
  )
  await ctx.runMutation(internal.plugins.socialMedia.records.store.saveSync, {
    records,
    syncedAt: Date.now(),
  })
}

function compareRecords(a: WcaRecord, b: WcaRecord): number {
  return (
    wcaEventOrder(a.eventId) - wcaEventOrder(b.eventId) ||
    a.roundNumber - b.roundNumber ||
    (a.type === b.type ? 0 : a.type === "single" ? -1 : 1) ||
    a.personName.localeCompare(b.personName)
  )
}

/**
 * Records grouped by competition, the competitions in the order they ended
 * (then by name) and each one's records by event, round and type.
 */
export function groupByCompetition<R extends WcaRecord>(
  records: readonly R[]
): CompetitionRecords<R>[] {
  const competitions = new Map<string, CompetitionRecords<R>>()
  for (const record of records) {
    const group = competitions.get(record.liveCompetitionId) ?? {
      liveCompetitionId: record.liveCompetitionId,
      wcaCompetitionId: record.wcaCompetitionId,
      competitionName: record.competitionName,
      competitionEndDate: record.competitionEndDate,
      records: [],
    }
    group.records.push(record)
    competitions.set(record.liveCompetitionId, group)
  }

  const grouped = [...competitions.values()]
  for (const competition of grouped) competition.records.sort(compareRecords)
  return grouped.sort(
    (a, b) =>
      a.competitionEndDate.localeCompare(b.competitionEndDate) ||
      a.competitionName.localeCompare(b.competitionName)
  )
}
