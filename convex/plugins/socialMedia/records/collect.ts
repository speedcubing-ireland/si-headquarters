import { z } from "zod"
import { localDateOffset } from "@/convex/notifications/localTime"
import { WCA_EVENT_ORDER } from "@/convex/plugins/wca/eventLabels"
import type {
  RecordKind,
  RecordType,
} from "@/convex/plugins/socialMedia/records/format"
import type { WeekWindow } from "@/convex/plugins/socialMedia/records/window"

/**
 * WCA Live's public GraphQL endpoint. It has no staging instance, so every
 * deployment reads production whatever `DEPLOYMENT_CONTEXT` says; the query is
 * public and read-only, so that is safe.
 */
export const WCA_LIVE_URL = "https://live.worldcubeassociation.org"

/**
 * The records WCA Live shows as "Recent records": every WR, CR and NR from
 * competitions that started in the last 10 days, worldwide.
 */
const RECENT_RECORDS_QUERY = `{
  recentRecords {
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
          competition { id name endDate }
        }
      }
    }
  }
}`

const recentRecordSchema = z.object({
  tag: z.enum(["NR", "CR", "WR"]),
  type: z.enum(["single", "average"]),
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
          name: z.string(),
          endDate: z.string(),
        }),
      }),
    }),
  }),
})

const recentRecordsResponseSchema = z.object({
  data: z.object({ recentRecords: z.array(recentRecordSchema) }),
})

export type RecentRecord = z.infer<typeof recentRecordSchema>

export interface WeeklyRecord {
  /** Null for a newcomer, who has no WCA ID until results are posted. */
  wcaId: string | null
  personName: string
  eventId: string
  roundName: string
  roundNumber: number
  type: RecordType
  value: number
  marker: RecordKind
}

export interface CompetitionRecords {
  /** WCA Live's id, for linking to the live results. */
  liveCompetitionId: string
  competitionName: string
  records: WeeklyRecord[]
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

const EVENT_INDEX = new Map(
  WCA_EVENT_ORDER.map((eventId, index) => [eventId, index])
)

function eventOrder(eventId: string): number {
  return EVENT_INDEX.get(eventId) ?? WCA_EVENT_ORDER.length
}

function compareRecords(a: WeeklyRecord, b: WeeklyRecord): number {
  return (
    eventOrder(a.eventId) - eventOrder(b.eventId) ||
    a.roundNumber - b.roundNumber ||
    (a.type === b.type ? 0 : a.type === "single" ? -1 : 1) ||
    a.personName.localeCompare(b.personName)
  )
}

/**
 * The records set by competitors from `countryIso2` at competitions that ended
 * inside the window, grouped by competition (by name) and in the order they were
 * set. Counting a competition in the week it ends reports each one once, after
 * it has finished.
 */
export function selectWeeklyRecords(
  records: readonly RecentRecord[],
  countryIso2: string,
  window: WeekWindow
): CompetitionRecords[] {
  const weekEnd = localDateOffset(window.weekStart, 7)
  const competitions = new Map<string, CompetitionRecords>()
  for (const record of records) {
    const { person, round } = record.result
    const { competition, event } = round.competitionEvent
    if (person.country.iso2 !== countryIso2) continue
    if (
      competition.endDate < window.weekStart ||
      competition.endDate >= weekEnd
    )
      continue

    const group = competitions.get(competition.id) ?? {
      liveCompetitionId: competition.id,
      competitionName: competition.name,
      records: [],
    }
    group.records.push({
      wcaId: person.wcaId,
      personName: person.name,
      eventId: event.id,
      roundName: round.name,
      roundNumber: round.number,
      type: record.type,
      value: record.attemptResult,
      marker: record.tag,
    })
    competitions.set(competition.id, group)
  }

  const grouped = [...competitions.values()]
  for (const competition of grouped) competition.records.sort(compareRecords)
  return grouped.sort((a, b) =>
    a.competitionName.localeCompare(b.competitionName)
  )
}

/**
 * The week's records for `countryIso2`, from one WCA Live request. Its window
 * reaches back 10 days by start date, so a Monday run covers every competition
 * that ended the week before unless it started more than three days before
 * that week.
 */
export async function collectWeeklyRecords(
  countryIso2: string,
  window: WeekWindow
): Promise<CompetitionRecords[]> {
  return selectWeeklyRecords(await fetchRecentRecords(), countryIso2, window)
}
