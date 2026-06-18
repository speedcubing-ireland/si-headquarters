import { describe, expect, test } from "vitest"
import type { Doc } from "@/convex/_generated/dataModel"
import { toSponsorAuctionListItem, toSponsorBidEventForUI } from "./shared"

function mockAuction(
  overrides: Partial<Doc<"sponsorshipAuctions">> = {}
): Doc<"sponsorshipAuctions"> {
  const now = Date.now()
  return {
    _id: "auction1" as Doc<"sponsorshipAuctions">["_id"],
    _creationTime: now,
    competitionId:
      "competition1" as Doc<"sponsorshipAuctions">["competitionId"],
    framework: "ebay_proxy",
    state: "active",
    currency: "EUR",
    startsAt: now - 10_000,
    endsAt: now + 10_000,
    antiSnipingWindowMs: 60_000,
    antiSnipingExtendMs: 60_000,
    startPriceCents: 1000,
    currentPriceCents: 1500,
    currentLeaderSponsorId:
      "sponsor1" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
    currentLeaderMaxCents: 4000,
    winnerSponsorId: undefined,
    winningBidId: undefined,
    settlementAmountCents: undefined,
    readinessSnapshotJson: undefined,
    createdById: "user1" as Doc<"sponsorshipAuctions">["createdById"],
    updatedById: "user1" as Doc<"sponsorshipAuctions">["updatedById"],
    updatedAt: now,
    ...overrides,
  }
}

function mockEvent(
  overrides: Partial<Doc<"sponsorshipBidEvents">> = {}
): Doc<"sponsorshipBidEvents"> {
  const now = Date.now()
  return {
    _id: "event1" as Doc<"sponsorshipBidEvents">["_id"],
    _creationTime: now,
    auctionId: "auction1" as Doc<"sponsorshipBidEvents">["auctionId"],
    sponsorId: "sponsor1" as Doc<"sponsorshipBidEvents">["sponsorId"],
    amountCents: 1500,
    isAuto: true,
    intentId: "intent1" as Doc<"sponsorshipBidEvents">["intentId"],
    createdAt: now,
    ...overrides,
  }
}

const baseCompetitionSummary = {
  name: "Irish Open",
  address: "Main Hall, Dublin, IE",
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  eventIds: ["333"],
}

describe("sponsor portal payload redaction", () => {
  test("auction payload does not expose leader max", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction(),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
    })
    expect(payload.competitionSummary).toEqual(baseCompetitionSummary)
    expect(payload.competitionSummarySource).toBe("wca")
    expect(
      (payload as { currentLeaderSponsorId?: string }).currentLeaderSponsorId
    ).toBeUndefined()
    expect(
      (payload as { currentLeaderMaxCents?: number }).currentLeaderMaxCents
    ).toBeUndefined()
    expect(Object.keys(payload)).not.toContain("currentLeaderSponsorId")
    expect(Object.keys(payload)).not.toContain("currentLeaderMaxCents")
  })

  test("minimum next bid stays at start price when no bids exist yet", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        startPriceCents: 100,
        currentPriceCents: 100,
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: false,
    })
    expect(payload.minimumNextBidCents).toBe(100)
  })

  test("minimum next bid increments from current price once bids exist", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        startPriceCents: 100,
        currentPriceCents: 100,
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
    })
    expect(payload.minimumNextBidCents).toBe(120)
  })

  test("active proxy auction includes sponsor winning status", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        state: "active",
        framework: "ebay_proxy",
        currentLeaderSponsorId:
          "sponsor1" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
      sponsorId: "sponsor1" as Doc<"sponsors">["_id"],
      hasSponsorValidBid: true,
    })
    expect(payload.sponsorBidStatus).toBe("winning")
  })

  test("active proxy auction shows no-bid status before sponsor bids", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        state: "active",
        framework: "ebay_proxy",
        currentLeaderSponsorId:
          "sponsor2" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
      sponsorId: "sponsor1" as Doc<"sponsors">["_id"],
      hasSponsorValidBid: false,
    })
    expect(payload.sponsorBidStatus).toBe("no_bid_submitted")
  })

  test("closed auction includes sponsor winner status", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        state: "closed",
        winnerSponsorId:
          "sponsor2" as Doc<"sponsorshipAuctions">["winnerSponsorId"],
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
      sponsorId: "sponsor1" as Doc<"sponsors">["_id"],
    })
    expect(payload.sponsorBidStatus).toBe("not_winner")
  })

  test("active sealed auction shows bid-submitted status without leader info", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        state: "active",
        framework: "first_sealed",
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
      sponsorId: "sponsor1" as Doc<"sponsors">["_id"],
      hasSponsorValidBid: true,
    })
    expect(payload.sponsorBidStatus).toBe("bid_submitted")
  })

  test("closed sealed auction with a submitted bid resolves to win status", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        state: "closed",
        framework: "vickrey",
        winnerSponsorId:
          "sponsor2" as Doc<"sponsorshipAuctions">["winnerSponsorId"],
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
      sponsorId: "sponsor1" as Doc<"sponsors">["_id"],
      hasSponsorValidBid: true,
    })
    expect(payload.sponsorBidStatus).toBe("not_winner")
  })

  test("sealed auction uses no-bid status when sponsor has not bid", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        state: "closed",
        framework: "first_sealed",
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
      sponsorId: "sponsor1" as Doc<"sponsors">["_id"],
      hasSponsorValidBid: false,
    })
    expect(payload.sponsorBidStatus).toBe("no_bid_submitted")
  })

  test("sealed auctions use start price as minimum bid", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        framework: "first_sealed",
        startPriceCents: 10_000,
        currentPriceCents: 15_000,
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
    })
    expect(payload.minimumNextBidCents).toBe(10_000)
  })

  test("sealed auctions always keep minimum bid at competition start price", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        framework: "first_sealed",
        startPriceCents: 12_000,
        currentPriceCents: 18_000,
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: false,
    })
    expect(payload.minimumNextBidCents).toBe(12_000)
  })

  test("vickrey auctions follow sealed visibility and minimum rules", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        framework: "vickrey",
        state: "active",
        startPriceCents: 12_000,
        currentPriceCents: 18_000,
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
    })
    expect(payload.currentPriceCents).toBeUndefined()
    expect(payload.minimumNextBidCents).toBe(12_000)
  })

  test("closed vickrey auction keeps settlement visible without exposing leading bid", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        framework: "vickrey",
        state: "closed",
        currentPriceCents: 20_000,
        settlementAmountCents: 12_000,
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
    })
    expect(payload.currentPriceCents).toBeUndefined()
    expect(payload.settlementAmountCents).toBe(12_000)
  })

  test("closed first-price sealed auction does not expose leading bid", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        framework: "first_sealed",
        state: "closed",
        currentPriceCents: 20_000,
        settlementAmountCents: 20_000,
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
    })
    expect(payload.currentPriceCents).toBeUndefined()
    expect(payload.settlementAmountCents).toBe(20_000)
  })

  test("sealed auctions hide current price before close", () => {
    const payload = toSponsorAuctionListItem({
      auction: mockAuction({
        framework: "first_sealed",
        state: "active",
        currentPriceCents: 15_000,
      }),
      competitionName: "Irish Open",
      competitionSummary: baseCompetitionSummary,
      competitionSummarySource: "wca",
      hasAnyValidBid: true,
    })
    expect(payload.currentPriceCents).toBeUndefined()
  })

  test("bid event payload does not expose sponsor ids or intent ids", () => {
    const payload = toSponsorBidEventForUI({
      event: mockEvent(),
      sponsorLabel: "Bidder 1",
      isOwnBid: false,
    })
    expect((payload as { sponsorId?: string }).sponsorId).toBeUndefined()
    expect((payload as { intentId?: string }).intentId).toBeUndefined()
    expect(Object.keys(payload)).not.toContain("sponsorId")
    expect(Object.keys(payload)).not.toContain("intentId")
  })

  test("bid event payload does not expose manual vs auto strategy for other sponsors", () => {
    const payload = toSponsorBidEventForUI({
      event: mockEvent({ isAuto: false }),
      sponsorLabel: "Bidder 1",
      isOwnBid: false,
    })
    expect(payload.isAuto).toBe(true)
  })
})
