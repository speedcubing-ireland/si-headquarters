import type { RecentRecord } from "@/convex/plugins/socialMedia/records/collect"
import type { WcaRecord } from "@/convex/plugins/socialMedia/validators"

/** A record as it is stored, with every field overridable. */
export function wcaRecord(overrides: Partial<WcaRecord> = {}): WcaRecord {
  const record: WcaRecord = {
    liveRecordId: "",
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
  // Distinct records get distinct ids unless a test pins one.
  return {
    ...record,
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
            id: record.liveCompetitionId,
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
