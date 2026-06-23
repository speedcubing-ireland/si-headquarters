import { afterEach, describe, expect, test, vi } from "vitest"
import * as organisation from "@/config/lib/organisation"
import {
  applyAuctionSubjectDraftPatch,
  buildAuctionSubjectInput,
  getAuctionSubjectSourceOptions,
  isAllowedAuctionSubjectSource,
  normalizeAuctionSubjectDraft,
} from "@/plugins/sponsor/admin/auction-subject-draft"

describe("auction subject source options", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("includes WCA competition when wcaIntegration is enabled", () => {
    vi.spyOn(organisation, "isFeatureEnabled").mockImplementation(
      (feature) => feature === "wcaIntegration"
    )

    expect(
      getAuctionSubjectSourceOptions().map((option) => option.value)
    ).toEqual(["hq_competition", "wca_competition", "custom"])
    expect(isAllowedAuctionSubjectSource("wca_competition")).toBe(true)
  })

  test("omits WCA competition when wcaIntegration is disabled", () => {
    vi.spyOn(organisation, "isFeatureEnabled").mockReturnValue(false)

    expect(
      getAuctionSubjectSourceOptions().map((option) => option.value)
    ).toEqual(["hq_competition", "custom"])
    expect(isAllowedAuctionSubjectSource("wca_competition")).toBe(false)
  })

  test("rejects WCA subject input when wcaIntegration is disabled", () => {
    vi.spyOn(organisation, "isFeatureEnabled").mockReturnValue(false)

    const result = buildAuctionSubjectInput({
      source: "wca_competition",
      hqCompetitionId: null,
      wca: {
        id: "TestComp2026",
        name: "Test Comp",
        city: "Dublin",
        countryIso2: "IE",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
      },
      customName: "",
      customDescriptionMarkdown: "",
      customCompetitionId: null,
    })

    expect(result).toEqual({
      ok: false,
      error: "WCA competitions are not available for this organisation.",
    })
  })

  test("normalizes WCA source to HQ when wcaIntegration is disabled", () => {
    vi.spyOn(organisation, "isFeatureEnabled").mockReturnValue(false)

    const wcaDraft = {
      source: "wca_competition" as const,
      hqCompetitionId: null,
      wca: {
        id: "TestComp2026",
        name: "Test Comp",
        city: "Dublin",
        countryIso2: "IE",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
      },
      customName: "",
      customDescriptionMarkdown: "",
      customCompetitionId: null,
    }

    expect(normalizeAuctionSubjectDraft(wcaDraft)).toEqual({
      ...wcaDraft,
      source: "hq_competition",
      wca: null,
    })
    expect(applyAuctionSubjectDraftPatch(wcaDraft, {})).toEqual({
      ...wcaDraft,
      source: "hq_competition",
      wca: null,
    })
  })
})
