import { describe, expect, test } from "vitest"
import type { Doc } from "@/convex/_generated/dataModel"
import { resolveAuctionOutcome } from "./auctionState"

type AuctionDoc = Doc<"sponsorshipAuctions">
type IntentDoc = Doc<"sponsorshipBidIntents">

function makeAuction(overrides: Partial<AuctionDoc> = {}): AuctionDoc {
  const now = Date.now()
  return {
    _id: "auction1" as AuctionDoc["_id"],
    _creationTime: now,
    competitionId: "comp1" as AuctionDoc["competitionId"],
    framework: "ebay_proxy",
    state: "active",
    currency: "EUR",
    startsAt: now - 1000,
    endsAt: now + 1000,
    antiSnipingWindowMs: 0,
    antiSnipingExtendMs: 0,
    startPriceCents: 1000,
    createdById: "u1" as AuctionDoc["createdById"],
    updatedById: "u1" as AuctionDoc["updatedById"],
    updatedAt: now,
    ...overrides,
  }
}

function makeIntent(
  id: string,
  sponsorId: string,
  maxAmountCents: number,
  overrides: Partial<IntentDoc> = {}
): IntentDoc {
  const now = Date.now()
  return {
    _id: id as IntentDoc["_id"],
    _creationTime: now,
    auctionId: "auction1" as IntentDoc["auctionId"],
    sponsorId: sponsorId as IntentDoc["sponsorId"],
    mode: "proxy",
    amountCents: maxAmountCents,
    maxAmountCents,
    isValid: true,
    createdAt: now,
    ...overrides,
  }
}

describe("resolveAuctionOutcome — proxy auctions", () => {
  test("winner always carries a defined settlement", () => {
    const auction = makeAuction()
    const intents = [makeIntent("i1", "sA", 5000), makeIntent("i2", "sB", 3000)]

    const outcome = resolveAuctionOutcome({ auction, validIntents: intents })

    expect(outcome.kind).toBe("winner")
    if (outcome.kind !== "winner") throw new Error("expected winner")
    expect(outcome.winnerSponsorId).toBe("sA")
    expect(outcome.winningBidId).toBe("i1")
    expect(outcome.settlementAmountCents).toBeTypeOf("number")
    expect(outcome.settlementAmountCents).toBeGreaterThan(0)
  })

  test("ignores stale denormalized currentLeaderSponsorId / currentPriceCents", () => {
    const auction = makeAuction({
      currentLeaderSponsorId: "ghost" as AuctionDoc["currentLeaderSponsorId"],
      currentPriceCents: 999_999,
    })
    const intents = [makeIntent("i1", "sA", 5000), makeIntent("i2", "sB", 3000)]

    const outcome = resolveAuctionOutcome({ auction, validIntents: intents })

    expect(outcome.kind).toBe("winner")
    if (outcome.kind !== "winner") throw new Error("expected winner")
    expect(outcome.winnerSponsorId).toBe("sA")
    expect(outcome.settlementAmountCents).not.toBe(999_999)
    expect(outcome.settlementAmountCents).toBeLessThanOrEqual(5000)
    expect(outcome.winningBidId).toBe("i1")
  })

  test("no valid intents yields no winner", () => {
    const outcome = resolveAuctionOutcome({
      auction: makeAuction(),
      validIntents: [],
    })
    expect(outcome).toEqual({ kind: "no_winner" })
  })
})

describe("resolveAuctionOutcome — sealed auctions", () => {
  test("first-price winner always carries exact settlement and winning bid", () => {
    const auction = makeAuction({ framework: "first_sealed" })
    const intents = [
      makeIntent("i1", "sA", 5000, { mode: "manual" }),
      makeIntent("i2", "sB", 3000, { mode: "manual" }),
    ]

    const outcome = resolveAuctionOutcome({ auction, validIntents: intents })

    expect(outcome.kind).toBe("winner")
    if (outcome.kind !== "winner") throw new Error("expected winner")
    expect(outcome.winnerSponsorId).toBe("sA")
    expect(outcome.winningBidId).toBe("i1")
    expect(outcome.settlementAmountCents).toBe(5000)
  })

  test("vickrey winner carries the winning bid id and second-price settlement", () => {
    const auction = makeAuction({ framework: "vickrey", startPriceCents: 1000 })
    const intents = [
      makeIntent("i1", "sA", 5000, { mode: "manual" }),
      makeIntent("i2", "sB", 3000, { mode: "manual" }),
    ]

    const outcome = resolveAuctionOutcome({ auction, validIntents: intents })

    expect(outcome.kind).toBe("winner")
    if (outcome.kind !== "winner") throw new Error("expected winner")
    expect(outcome.winnerSponsorId).toBe("sA")
    expect(outcome.winningBidId).toBe("i1")
    expect(outcome.settlementAmountCents).toBe(3000)
  })
})
