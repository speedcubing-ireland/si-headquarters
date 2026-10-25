import type { RecentRecord } from "@/convex/plugins/socialMedia/records/collect"

/** A record as WCA Live's `recentRecords` query returns it. */
export function recentRecord(
  overrides: {
    tag?: RecentRecord["tag"]
    type?: RecentRecord["type"]
    attemptResult?: number
    personName?: string
    wcaId?: string | null
    countryIso2?: string
    roundName?: string
    roundNumber?: number
    eventId?: string
    liveCompetitionId?: string
    competitionName?: string
    endDate?: string
  } = {}
): RecentRecord {
  return {
    tag: overrides.tag ?? "NR",
    type: overrides.type ?? "single",
    attemptResult: overrides.attemptResult ?? 987,
    result: {
      person: {
        name: overrides.personName ?? "Aoife Murphy",
        wcaId: overrides.wcaId === undefined ? "2015MURP01" : overrides.wcaId,
        country: { iso2: overrides.countryIso2 ?? "IE" },
      },
      round: {
        name: overrides.roundName ?? "Final",
        number: overrides.roundNumber ?? 2,
        competitionEvent: {
          event: { id: overrides.eventId ?? "333" },
          competition: {
            id: overrides.liveCompetitionId ?? "101",
            name: overrides.competitionName ?? "Dublin Open 2026",
            endDate: overrides.endDate ?? "2026-10-25",
          },
        },
      },
    },
  }
}
