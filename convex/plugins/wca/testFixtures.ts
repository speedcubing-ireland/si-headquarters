import type { CompetitionInfo } from "@/convex/plugins/wca/openapiClient/types.gen"

/**
 * A full `/v0/competitions/{id}` response, for tests that need one.
 *
 * Shared because `CompetitionInfo` is generated from the WCA's OpenAPI spec and
 * has ~40 required fields: a per-suite copy means every regeneration that adds
 * or renames one breaks each copy separately.
 */
export function sampleCompetitionInfo(
  overrides: Partial<CompetitionInfo> = {}
): CompetitionInfo {
  return {
    id: "HiddenComp2026",
    name: "Hidden Open 2026",
    information: "Competition info",
    venue: "Community Hall",
    contact: "organiser@example.com",
    registration_open: "2026-01-01",
    registration_close: "2026-02-01",
    use_wca_registration: true,
    guests_enabled: false,
    announced_at: "2025-12-01",
    base_entry_fee_lowest_denomination: 1000,
    currency_code: "EUR",
    start_date: "2026-03-01",
    end_date: "2026-03-02",
    enable_donations: false,
    competitor_limit: 120,
    on_the_spot_registration: false,
    refund_policy_percent: 100,
    refund_policy_limit_date: "2026-02-15",
    guests_entry_fee_lowest_denomination: 0,
    qualification_results: false,
    event_restrictions: false,
    waiting_list_deadline_date: "2026-02-20",
    event_change_deadline_date: "2026-02-20",
    competitor_can_cancel: "never",
    url: "https://www.worldcubeassociation.org/competitions/HiddenComp2026",
    website: "",
    city: "Dublin",
    venue_address: "1 Example Street",
    latitude_degrees: 53.3498,
    longitude_degrees: -6.2603,
    country_iso2: "IE",
    event_ids: ["333", "444"],
    main_event_id: "333",
    number_of_bookmarks: 0,
    "uses_qualification?": false,
    "registration_full?": false,
    "registration_full_and_accepted?": false,
    tab_names: [],
    delegates: [],
    organizers: [],
    ...overrides,
  } satisfies CompetitionInfo
}
