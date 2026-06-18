import { describe, expect, test } from "vitest"
import {
  isCompetitionSponsorManualOverride,
  resolveCompetitionSponsorPropertyStatus,
  resolveCompetitionSponsorStatus,
} from "@/convex/plugins/sponsor/lib/competitionSponsorStatus"

describe("competitionSponsorStatus", () => {
  test("resolveCompetitionSponsorPropertyStatus derives status from auctions", () => {
    expect(
      resolveCompetitionSponsorPropertyStatus({ override: null, auctions: [] })
    ).toBe("not_offered")
    expect(
      resolveCompetitionSponsorPropertyStatus({
        override: null,
        auctions: [{ state: "draft", winnerSponsorId: undefined }],
      })
    ).toBe("bidding")
    expect(
      resolveCompetitionSponsorPropertyStatus({
        override: null,
        auctions: [{ state: "closed", winnerSponsorId: "s1" as never }],
      })
    ).toBe("sponsor")
    expect(
      resolveCompetitionSponsorPropertyStatus({
        override: null,
        auctions: [{ state: "closed", winnerSponsorId: undefined }],
      })
    ).toBe("none")
  })

  test("resolveCompetitionSponsorPropertyStatus merges competition and auctions", () => {
    expect(
      resolveCompetitionSponsorPropertyStatus({
        override: { manualSponsorPropertyStatus: "none" },
        auctions: [{ state: "active", winnerSponsorId: undefined }],
      })
    ).toBe("none")
    expect(
      isCompetitionSponsorManualOverride({
        manualSponsorPropertyStatus: "none",
      })
    ).toBe(true)
  })

  test("resolveCompetitionSponsorStatus respects manual fields", () => {
    expect(
      resolveCompetitionSponsorStatus({
        auctionStates: ["closed"],
        hasClosedWinner: false,
        manualStatus: "none",
      })
    ).toBe("none")
    expect(
      resolveCompetitionSponsorStatus({
        auctionStates: ["active"],
        hasClosedWinner: false,
        manualSponsorId: "s1" as never,
      })
    ).toBe("sponsor")
  })
})
