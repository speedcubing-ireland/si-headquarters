import { afterEach, describe, expect, test, vi } from "vitest"
import type { CompetitionInfo } from "@/convex/plugins/wca/openapiClient/types.gen"
import {
  fetchCompetitionDetails,
  mapCompetitionInfoToDetails,
} from "./competitionDetails"
import * as wcaClient from "@/convex/plugins/wca/client"
import * as wcaSdk from "@/convex/plugins/wca/openapiClient/sdk.gen"

function sampleCompetitionInfo(
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

describe("mapCompetitionInfoToDetails", () => {
  test("maps WCA competition info into sponsorship snapshot details", () => {
    const mapped = mapCompetitionInfoToDetails(sampleCompetitionInfo())

    expect(mapped).toEqual({
      id: "HiddenComp2026",
      name: "Hidden Open 2026",
      city: "Dublin",
      country_iso2: "IE",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      event_ids: ["333", "444"],
      competitor_limit: 120,
      venue: "Community Hall",
      venue_address: "1 Example Street",
      latitude_degrees: 53.3498,
      longitude_degrees: -6.2603,
    })
  })

  test("omits optional location fields when they are blank", () => {
    const mapped = mapCompetitionInfoToDetails(
      sampleCompetitionInfo({
        venue_address: "   ",
        latitude_degrees: Number.NaN,
        longitude_degrees: Number.NaN,
      })
    )

    expect(mapped.venue_address).toBeUndefined()
    expect(mapped.latitude_degrees).toBeUndefined()
    expect(mapped.longitude_degrees).toBeUndefined()
  })
})

describe("fetchCompetitionDetails", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("uses the authenticated WCA client and returns mapped details", async () => {
    const competition = sampleCompetitionInfo()
    const createWcaClient = vi
      .spyOn(wcaClient, "createWcaClient")
      .mockReturnValue({} as ReturnType<typeof wcaClient.createWcaClient>)
    const competitionById = vi
      .spyOn(wcaSdk, "competitionById")
      .mockResolvedValue({
        data: competition,
        error: undefined,
      } as Awaited<ReturnType<typeof wcaSdk.competitionById>>)

    const result = await fetchCompetitionDetails(
      "service-account-token",
      "HiddenComp2026"
    )

    expect(result).toEqual({
      status: "found",
      details: mapCompetitionInfoToDetails(competition),
    })
    expect(createWcaClient).toHaveBeenCalledWith("service-account-token")
    expect(competitionById).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { competitionId: "HiddenComp2026" },
      })
    )
  })

  test("distinguishes a missing competition from transient WCA errors", async () => {
    vi.spyOn(wcaSdk, "competitionById").mockResolvedValue({
      data: undefined,
      error: {
        error: "Not found",
        data: { model: "Competition", id: "MissingComp2026" },
      },
      response: new Response(null, { status: 404 }),
    } as Awaited<ReturnType<typeof wcaSdk.competitionById>>)

    await expect(
      fetchCompetitionDetails("service-account-token", "MissingComp2026")
    ).resolves.toEqual({ status: "not_found" })

    vi.mocked(wcaSdk.competitionById).mockResolvedValue({
      data: undefined,
      error: { error: "Service unavailable" },
      response: new Response(null, { status: 503 }),
    } as Awaited<ReturnType<typeof wcaSdk.competitionById>>)

    await expect(
      fetchCompetitionDetails("service-account-token", "ExistingComp2026")
    ).resolves.toEqual({ status: "fetch_failed" })
  })
})
