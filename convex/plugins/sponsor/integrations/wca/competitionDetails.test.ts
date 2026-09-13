import { afterEach, describe, expect, test, vi } from "vitest"
import {
  fetchCompetitionDetails,
  mapCompetitionInfoToDetails,
} from "./competitionDetails"
import { sampleCompetitionInfo } from "@/convex/plugins/wca/testFixtures"
import * as wcaClient from "@/convex/plugins/wca/client"
import * as wcaSdk from "@/convex/plugins/wca/openapiClient/sdk.gen"

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
