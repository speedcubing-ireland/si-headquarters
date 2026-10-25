import { localDateOffset } from "@/convex/notifications/localTime"
import { mapWithConcurrency } from "@/convex/plugins/events/concurrency"
import type { WcaClient } from "@/convex/plugins/wca/client"
import { WCA_EVENT_LABELS } from "@/convex/plugins/wca/eventLabels"
import {
  competitionList,
  getRecords2,
} from "@/convex/plugins/wca/openapiClient/sdk.gen"
import type { Record as WcaRecord } from "@/convex/plugins/wca/openapiClient/types.gen"
import type { RecordType } from "@/convex/plugins/socialMedia/records/format"
import type { WeekWindow } from "@/convex/plugins/socialMedia/records/window"

/**
 * How far before the week a competition may have started and still have its
 * results posted during it. The WCA usually posts within days; this only bounds
 * how many competitions are looked up, so it errs well on the generous side.
 */
export const RESULTS_POSTING_LOOKBACK_DAYS = 120

/** Parallel competition lookups, matching the WCA status sync's budget. */
const COMPETITION_LOOKUP_CONCURRENCY = 6

export interface WeeklyRecord {
  competitionId: string
  competitionName: string
  personId: string
  personName: string
  eventId: string
  roundTypeId: string
  type: RecordType
  value: number
  /** The WCA's marker: "NR", "WR", or a continental code such as "ER". */
  marker: string
}

/**
 * Every record ever set by a competitor from `countryId`: national records and
 * any continental or world records, which the WCA marks with the higher record
 * only. Each entry is one record, so a result that broke both the single and
 * the average record appears twice, once per `type`.
 */
export async function fetchRecordHistory(
  client: WcaClient,
  countryId: string
): Promise<WcaRecord[]> {
  const response = await getRecords2({
    client,
    query: { region: countryId, show: "history" },
  })
  if (response.error !== undefined || response.data === undefined) {
    throw new Error("WCA record history lookup failed.")
  }
  return Object.values(response.data.records).flat()
}

/**
 * When each competition's results were posted, or null while they are not.
 * Throws rather than guessing when a lookup fails: a run that cannot tell is
 * retried, where a guess could tell the team that nothing happened.
 */
export async function fetchResultsPostedAt(
  client: WcaClient,
  competitionIds: readonly string[]
): Promise<Map<string, string | null>> {
  const postedAt = await mapWithConcurrency(
    competitionIds,
    COMPETITION_LOOKUP_CONCURRENCY,
    async (competitionId): Promise<[string, string | null]> => {
      // `q` is a substring search, so pick the exact id out of the matches.
      const response = await competitionList({
        client,
        query: { q: competitionId, include_cancelled: true },
      })
      if (response.error !== undefined || response.data === undefined) {
        throw new Error(`WCA competition lookup failed for ${competitionId}.`)
      }
      const competition = response.data.find(
        (candidate) => candidate.id === competitionId
      )
      return [competitionId, competition?.results_posted_at ?? null]
    }
  )
  return new Map(postedAt)
}

function recordType(record: WcaRecord): RecordType {
  if (record.type === "average") return "average"
  if (record.type === "single") return "single"
  // Not documented as always present; an entry without it can only be read
  // from which marker is set.
  return record.regional_single_record === null ? "average" : "single"
}

/**
 * Entries recent enough that their results could have been posted during the
 * week, and so worth a competition lookup. Restricted to `countryId` too, in
 * case the WCA ever widens `region` to cover where the competition was held.
 */
export function candidateRecords(
  history: readonly WcaRecord[],
  countryId: string,
  window: WeekWindow
): WcaRecord[] {
  const earliestStart = localDateOffset(
    window.weekStart,
    -RESULTS_POSTING_LOOKBACK_DAYS
  )
  const latestStart = localDateOffset(window.weekStart, 7)
  return history.filter(
    (record) =>
      record.country_id === countryId &&
      record.start_date >= earliestStart &&
      record.start_date < latestStart
  )
}

const EVENT_ORDER = new Map(
  Object.keys(WCA_EVENT_LABELS).map((eventId, index) => [eventId, index])
)

// The WCA's round type ids in the order rounds are held; combined (cutoff)
// rounds sit beside their plain counterparts.
const ROUND_ORDER = new Map(
  ["0", "h", "1", "d", "2", "e", "3", "g", "b", "f", "c"].map(
    (roundTypeId, index) => [roundTypeId, index]
  )
)

function compareRecords(a: WeeklyRecord, b: WeeklyRecord): number {
  return (
    a.competitionName.localeCompare(b.competitionName) ||
    (EVENT_ORDER.get(a.eventId) ?? EVENT_ORDER.size) -
      (EVENT_ORDER.get(b.eventId) ?? EVENT_ORDER.size) ||
    (ROUND_ORDER.get(a.roundTypeId) ?? ROUND_ORDER.size) -
      (ROUND_ORDER.get(b.roundTypeId) ?? ROUND_ORDER.size) ||
    (a.type === b.type ? 0 : a.type === "single" ? -1 : 1) ||
    a.personName.localeCompare(b.personName)
  )
}

/**
 * The records from competitions whose results were posted inside the window,
 * grouped by competition and in the order they were set. Every record is kept,
 * including one broken again later in the same competition.
 */
export function selectRecordsPostedInWindow(
  records: readonly WcaRecord[],
  resultsPostedAt: ReadonlyMap<string, string | null>,
  window: WeekWindow
): WeeklyRecord[] {
  const selected: WeeklyRecord[] = []
  for (const record of records) {
    const postedAt = resultsPostedAt.get(record.competition_id) ?? null
    if (postedAt === null) continue
    const postedAtMs = Date.parse(postedAt)
    if (!(postedAtMs >= window.startMs && postedAtMs < window.endMs)) continue

    const type = recordType(record)
    const marker =
      type === "single"
        ? record.regional_single_record
        : record.regional_average_record
    if (marker === null || marker === "") continue

    selected.push({
      competitionId: record.competition_id,
      competitionName: record.competition_name,
      personId: record.person_id,
      personName: record.person_name,
      eventId: record.event_id,
      roundTypeId: record.round_type_id,
      type,
      value: record.value,
      marker,
    })
  }
  return selected.sort(compareRecords)
}

/**
 * The week's records for `countryId`: one request for the record history, then
 * one per competition recent enough to have had its results posted that week.
 */
export async function collectWeeklyRecords(
  client: WcaClient,
  countryId: string,
  window: WeekWindow
): Promise<WeeklyRecord[]> {
  const history = await fetchRecordHistory(client, countryId)
  const candidates = candidateRecords(history, countryId, window)
  const competitionIds = [
    ...new Set(candidates.map((record) => record.competition_id)),
  ]
  const resultsPostedAt = await fetchResultsPostedAt(client, competitionIds)
  return selectRecordsPostedInWindow(candidates, resultsPostedAt, window)
}
