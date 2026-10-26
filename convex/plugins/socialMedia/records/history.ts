import { z } from "zod"
import {
  RECORD_TYPES,
  recordTag,
} from "@/convex/plugins/socialMedia/records/kinds"
import type { WcaRecord } from "@/convex/plugins/socialMedia/validators"

/**
 * One row of the WCA's records history, as
 * `/api/v0/results/records?region=<country>&show=history` returns it. The WCA
 * turns bots away from that endpoint, so it is saved from a browser and
 * imported with `scripts/backfill-records.ts`.
 */
const historyRowSchema = z.object({
  /** The result's id; a single and an average record can share it. */
  id: z.number(),
  type: z.enum(RECORD_TYPES),
  value: z.number(),
  /** "NR", "WR", or a continental code such as "ER". */
  record_name: z.string(),
  event_id: z.string(),
  round_type_id: z.string(),
  person_id: z.string(),
  person_name: z.string(),
  /** The competitor's country by name, e.g. "Ireland". */
  country_id: z.string(),
  competition_id: z.string(),
  competition_name: z.string(),
  start_date: z.string(),
})

const historySchema = z.object({
  records: z.record(z.string(), z.array(historyRowSchema)),
})

type HistoryRow = z.infer<typeof historyRowSchema>

/**
 * The WCA's round types, worded as WCA Live names rounds. The number only
 * orders rounds within an event: the history does not say how many rounds an
 * event had, so a final's real number is unknown.
 */
const ROUNDS: Partial<Record<string, { name: string; number: number }>> = {
  "0": { name: "Qualification Round", number: 0 },
  h: { name: "Qualification Round", number: 0 },
  "1": { name: "First Round", number: 1 },
  d: { name: "First Round", number: 1 },
  "2": { name: "Second Round", number: 2 },
  e: { name: "Second Round", number: 2 },
  "3": { name: "Semi Final", number: 3 },
  g: { name: "Semi Final", number: 3 },
  b: { name: "B Final", number: 4 },
  c: { name: "Final", number: 5 },
  f: { name: "Final", number: 5 },
}

function toRecord(row: HistoryRow, countryIso2: string): WcaRecord {
  const round = ROUNDS[row.round_type_id]
  if (round === undefined) {
    throw new Error(
      `Unknown round type "${row.round_type_id}" for result ${String(row.id)}.`
    )
  }
  return {
    liveRecordId: `wca:${String(row.id)}:${row.type}`,
    status: "confirmed",
    tag: recordTag(row.record_name),
    type: row.type,
    attemptResult: row.value,
    eventId: row.event_id,
    roundName: round.name,
    roundNumber: round.number,
    personName: row.person_name,
    wcaId: row.person_id,
    personCountryIso2: countryIso2,
    liveCompetitionId: null,
    wcaCompetitionId: row.competition_id,
    competitionName: row.competition_name,
    competitionStartDate: row.start_date,
    // The history only has the start date. Records are listed by end date, so
    // a multi-day competition lists from its first day.
    competitionEndDate: row.start_date,
  }
}

/**
 * The records in a saved records history file, as stored records. The history must
 * be the organisation's country's (`region=IE` for Ireland), so every
 * competitor is from `countryIso2`; a file with competitors from more than one
 * country is refused rather than mislabelled.
 */
export function toHistoryRecords(
  text: string,
  countryIso2: string
): WcaRecord[] {
  const parsed = historySchema.safeParse(JSON.parse(text))
  if (!parsed.success) {
    throw new Error(
      `Not a WCA records history: ${z.prettifyError(parsed.error)}`
    )
  }
  const rows = Object.values(parsed.data.records).flat()
  const countries = new Set(rows.map((row) => row.country_id))
  if (countries.size > 1) {
    throw new Error(
      `The history has competitors from ${[...countries].join(", ")}; export a single country's records (e.g. region=${countryIso2}).`
    )
  }
  return rows.map((row) => toRecord(row, countryIso2))
}
