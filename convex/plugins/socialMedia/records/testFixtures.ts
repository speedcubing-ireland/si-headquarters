import type { RecentRecord } from "@/convex/plugins/socialMedia/records/collect"
import type {
  WcaCompetition,
  WcaResult,
} from "@/convex/plugins/socialMedia/records/wcaResults"
import type { WcaRecord } from "@/convex/plugins/socialMedia/validators"

/** A record as it is stored, with every field overridable. */
export function wcaRecord(overrides: Partial<WcaRecord> = {}): WcaRecord {
  const record: WcaRecord = {
    liveRecordId: "",
    status: "live",
    tag: "NR",
    type: "single",
    attemptResult: 987,
    eventId: "333",
    roundName: "Final",
    roundNumber: 2,
    personName: "Aoife Murphy",
    wcaId: "2015MURP01",
    personCountryIso2: "IE",
    liveCompetitionId: "101",
    wcaCompetitionId: "DublinOpen2026",
    competitionName: "Dublin Open 2026",
    competitionStartDate: "2026-10-24",
    competitionEndDate: "2026-10-25",
    ...overrides,
  }
  // Distinct records get distinct ids, and another WCA Live competition is
  // another WCA competition, unless a test pins one.
  const otherCompetition =
    typeof overrides.liveCompetitionId === "string" &&
    overrides.liveCompetitionId !== "101"
  return {
    ...record,
    wcaCompetitionId:
      overrides.wcaCompetitionId ??
      (otherCompetition
        ? `Competition${record.liveCompetitionId ?? ""}`
        : record.wcaCompetitionId),
    liveRecordId:
      overrides.liveRecordId ??
      [
        record.liveCompetitionId,
        record.eventId,
        String(record.roundNumber),
        record.personName,
        record.type,
      ].join(":"),
  }
}

/**
 * A record as WCA Live's `recentRecords` query returns it, at a competition
 * with venues in `venueCountries`.
 */
export function recentRecord(
  overrides: Partial<WcaRecord> = {},
  venueCountries: readonly string[] = ["IE"]
): RecentRecord {
  const record = wcaRecord(overrides)
  return {
    id: record.liveRecordId,
    tag: record.tag,
    type: record.type,
    attemptResult: record.attemptResult,
    result: {
      person: {
        name: record.personName,
        wcaId: record.wcaId,
        country: { iso2: record.personCountryIso2 },
      },
      round: {
        name: record.roundName,
        number: record.roundNumber,
        competitionEvent: {
          event: { id: record.eventId },
          competition: {
            id: record.liveCompetitionId ?? "",
            wcaId: record.wcaCompetitionId,
            name: record.competitionName,
            startDate: record.competitionStartDate,
            endDate: record.competitionEndDate,
            venues: venueCountries.map((iso2) => ({ country: { iso2 } })),
          },
        },
      },
    },
  }
}

/** The fixture record's competition as the WCA lists it, results posted. */
export function wcaCompetition(
  overrides: Partial<WcaCompetition> = {}
): WcaCompetition {
  return {
    id: "DublinOpen2026",
    name: "Dublin Open 2026",
    start_date: "2026-10-24",
    end_date: "2026-10-25",
    country_iso2: "IE",
    results_posted_at: "2026-10-26T00:00:00.000Z",
    cancelled_at: null,
    ...overrides,
  }
}

/** The fixture record's result as the WCA posts it: round 2 of 3x3x3. */
export function wcaResult(overrides: Partial<WcaResult> = {}): WcaResult {
  return {
    id: 5000,
    round_id: 20,
    round_type_id: "f",
    event_id: "333",
    name: "Aoife Murphy",
    wca_id: "2015MURP01",
    country_iso2: "IE",
    best: 987,
    average: 1123,
    regional_single_record: "NR",
    regional_average_record: null,
    ...overrides,
  }
}

/**
 * Answers the WCA and WCA Live as the records code calls them: WCA Live's feed
 * with `records`, the WCA's competitions with `competitions` (all listed,
 * unless `listed` names fewer), and each competition's results from `results`.
 * A competition the WCA does not have is one whose results are not posted.
 */
export function wcaResponder(options: {
  records?: RecentRecord[]
  competitions?: WcaCompetition[]
  listed?: WcaCompetition[]
  results?: Record<string, WcaResult[]>
  failing?: string[]
}): (input: Parameters<typeof fetch>[0]) => Response {
  const api = "https://www.worldcubeassociation.org/api/v0/competitions"
  return (input) => {
    const url = input instanceof Request ? input.url : input.toString()
    if (url === "https://live.worldcubeassociation.org/api") {
      return Response.json({ data: { recentRecords: options.records ?? [] } })
    }
    if (url.startsWith(`${api}?`)) {
      const page = new URL(url).searchParams.get("page")
      const listed = options.listed ?? options.competitions ?? []
      return Response.json(page === "1" ? listed : [])
    }
    const [id, rest] = url.slice(api.length + 1).split("/")
    if (options.failing?.includes(id) === true) {
      return Response.json({ error: "unavailable" }, { status: 503 })
    }
    if (rest === "results") return Response.json(options.results?.[id] ?? [])
    return Response.json(
      options.competitions?.find((competition) => competition.id === id) ??
        wcaCompetition({ id, results_posted_at: null })
    )
  }
}

/** The text of an email's list under `title`, up to the next list or footer. */
export function listText(
  email: { text?: string },
  title: "CONFIRMED" | "PROVISIONAL"
): string {
  const text = email.text ?? ""
  const start = text.indexOf(title)
  if (start === -1) return ""
  const rest = text.slice(start)
  const end = rest.search(/\nPROVISIONAL|\nSent every Monday/)
  return end === -1 ? rest : rest.slice(0, end)
}
