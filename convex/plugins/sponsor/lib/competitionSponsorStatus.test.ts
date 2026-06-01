import { describe, expect, test } from "vitest"
import {
  deriveCompetitionSponsorStatusFromAuctions,
  isCompetitionSponsorManualOverride,
  resolveCompetitionSponsorPropertyStatus,
  resolveCompetitionSponsorStatus,
} from "@/convex/plugins/sponsor/lib/competitionSponsorStatus"

describe("competitionSponsorStatus", () => {
  test("deriveCompetitionSponsorStatusFromAuctions", () => {
    expect(deriveCompetitionSponsorStatusFromAuctions([])).toBe("not_offered")
    expect(
      deriveCompetitionSponsorStatusFromAuctions([
        { state: "draft", winnerSponsorId: undefined },
      ]),
    ).toBe("bidding")
    expect(
      deriveCompetitionSponsorStatusFromAuctions([
        { state: "closed", winnerSponsorId: "s1" as never },
      ]),
    ).toBe("sponsor")
    expect(
      deriveCompetitionSponsorStatusFromAuctions([
        { state: "closed", winnerSponsorId: undefined },
      ]),
    ).toBe("none")
  })

  test("resolveCompetitionSponsorPropertyStatus merges competition and auctions", () => {
    expect(
      resolveCompetitionSponsorPropertyStatus({
        competition: { manualSponsorPropertyStatus: "none" },
        auctions: [{ state: "active", winnerSponsorId: undefined }],
      }),
    ).toBe("none")
    expect(
      isCompetitionSponsorManualOverride({
        manualSponsorPropertyStatus: "none",
      }),
    ).toBe(true)
  })

  test("resolveCompetitionSponsorStatus respects manual fields", () => {
    expect(
      resolveCompetitionSponsorStatus({
        auctionStates: ["closed"],
        hasClosedWinner: false,
        manualStatus: "none",
      }),
    ).toBe("none")
    expect(
      resolveCompetitionSponsorStatus({
        auctionStates: ["active"],
        hasClosedWinner: false,
        manualSponsorId: "s1" as never,
      }),
    ).toBe("sponsor")
  })
})
