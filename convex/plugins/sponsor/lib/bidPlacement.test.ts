import { describe, expect, test, vi } from "vitest"
import type { Doc } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { placeSponsorshipBid } from "./bidPlacement"

type BidIntentDoc = Doc<"sponsorshipBidIntents">
type BidEventDoc = Doc<"sponsorshipBidEvents">

function activeAuction(
  overrides: Partial<Doc<"sponsorshipAuctions">> = {}
): Doc<"sponsorshipAuctions"> {
  const now = Date.now()
  return {
    _id: "auction1" as Doc<"sponsorshipAuctions">["_id"],
    _creationTime: now,
    competitionId: "comp1" as Doc<"sponsorshipAuctions">["competitionId"],
    framework: "ebay_proxy",
    state: "active",
    currency: "EUR",
    startsAt: now - 60_000,
    endsAt: now + 60_000,
    antiSnipingWindowMs: 5 * 60 * 1000,
    antiSnipingExtendMs: 5 * 60 * 1000,
    startPriceCents: 1000,
    currentPriceCents: 2000,
    currentLeaderSponsorId: undefined,
    currentLeaderMaxCents: undefined,
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

function mockIntent(overrides: Partial<BidIntentDoc> = {}): BidIntentDoc {
  const now = Date.now()
  return {
    _id: "intent-seed" as BidIntentDoc["_id"],
    _creationTime: now,
    auctionId: "auction1" as BidIntentDoc["auctionId"],
    sponsorId: "s1" as BidIntentDoc["sponsorId"],
    mode: "manual",
    amountCents: 2000,
    maxAmountCents: 2000,
    isValid: true,
    createdAt: now,
    ...overrides,
  }
}

function createMockMutationCtx(existingIntents: BidIntentDoc[] = []) {
  const intents = [...existingIntents]
  const events: BidEventDoc[] = []
  const patches: {
    table: string
    id: string
    patch: Partial<Doc<"sponsorshipAuctions">>
  }[] = []
  let insertedIntentCount = 0
  let insertedEventCount = 0

  const ctx = {
    db: {
      insert: async (table: string, value: Record<string, unknown>) => {
        if (table === "sponsorshipBidIntents") {
          insertedIntentCount += 1
          const doc = {
            ...value,
            _id: `intent-${String(insertedIntentCount)}` as BidIntentDoc["_id"],
            _creationTime:
              typeof value.createdAt === "number"
                ? value.createdAt
                : Date.now(),
          } as BidIntentDoc
          intents.push(doc)
          return doc._id
        }
        if (table === "sponsorshipBidEvents") {
          insertedEventCount += 1
          const doc = {
            ...value,
            _id: `event-${String(insertedEventCount)}` as BidEventDoc["_id"],
            _creationTime:
              typeof value.createdAt === "number"
                ? value.createdAt
                : Date.now(),
          } as BidEventDoc
          events.push(doc)
          return doc._id
        }
        throw new Error(`Unexpected insert table: ${table}`)
      },
      query: (table: string) => {
        if (table !== "sponsorshipBidIntents") {
          throw new Error(`Unexpected query table: ${table}`)
        }
        return {
          withIndex: () => ({
            collect: async () => intents,
          }),
        }
      },
      patch: async (
        table: string,
        id: string,
        patch: Partial<Doc<"sponsorshipAuctions">>
      ) => {
        patches.push({ table, id, patch })
      },
    },
  } as unknown as MutationCtx

  return { ctx, events, patches, intents }
}

function withPatchedAuction(
  auction: Doc<"sponsorshipAuctions">,
  patches: {
    patch: Partial<Doc<"sponsorshipAuctions">>
  }[]
): Doc<"sponsorshipAuctions"> {
  const lastPatchEntry = patches.at(-1)
  if (lastPatchEntry === undefined) return auction
  const latestPatch = lastPatchEntry.patch
  return {
    ...auction,
    currentPriceCents:
      latestPatch.currentPriceCents ?? auction.currentPriceCents,
    currentLeaderSponsorId:
      latestPatch.currentLeaderSponsorId ?? auction.currentLeaderSponsorId,
    currentLeaderMaxCents:
      latestPatch.currentLeaderMaxCents ?? auction.currentLeaderMaxCents,
    endsAt: latestPatch.endsAt ?? auction.endsAt,
    updatedAt: latestPatch.updatedAt ?? auction.updatedAt,
  }
}

describe("sponsorship bid placement", () => {
  test("rejects below-minimum bid", async () => {
    const auction = activeAuction()
    const { ctx } = createMockMutationCtx([
      mockIntent({
        _id: "intent-existing" as BidIntentDoc["_id"],
        sponsorId: "s0" as BidIntentDoc["sponsorId"],
        amountCents: 2000,
        maxAmountCents: 2000,
      }),
    ])
    await expect(
      placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "s1" as Doc<"sponsorshipBidIntents">["sponsorId"],
        amountCents: 2040,
        maxAmountCents: 2040,
      })
    ).rejects.toMatchObject({
      data: {
        code: "BAD_REQUEST",
      },
    })
  })

  test("rejects max below bid amount", async () => {
    const auction = activeAuction()
    const { ctx } = createMockMutationCtx()
    await expect(
      placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "s1" as Doc<"sponsorshipBidIntents">["sponsorId"],
        amountCents: 2200,
        maxAmountCents: 2100,
      })
    ).rejects.toMatchObject({
      data: {
        code: "BAD_REQUEST",
      },
    })
  })

  test("uses one timestamp for deadline validation and bid writes", async () => {
    const endsAt = 10_000
    const auction = activeAuction({
      endsAt,
      antiSnipingWindowMs: 0,
      antiSnipingExtendMs: 0,
    })
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(endsAt - 1)
      .mockReturnValueOnce(endsAt + 1_000)
    const { ctx, intents, patches } = createMockMutationCtx()

    try {
      await placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "s1" as BidIntentDoc["sponsorId"],
        amountCents: 2000,
      })
    } finally {
      nowSpy.mockRestore()
    }

    expect(intents[intents.length - 1]?.createdAt).toBe(endsAt - 1)
    expect(patches[patches.length - 1]?.patch.updatedAt).toBe(endsAt - 1)
  })

  test("rejects max-only updates below minimum next bid", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 3100,
      currentLeaderSponsorId:
        "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 5000,
    })
    const { ctx } = createMockMutationCtx([
      mockIntent({
        _id: "intent-a" as BidIntentDoc["_id"],
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 3000,
        maxAmountCents: 5000,
        createdAt: Date.now() - 1000,
        _creationTime: Date.now() - 1000,
      }),
      mockIntent({
        _id: "intent-b" as BidIntentDoc["_id"],
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        mode: "manual",
        amountCents: 3000,
        maxAmountCents: 3000,
        createdAt: Date.now() - 900,
        _creationTime: Date.now() - 900,
      }),
    ])

    await expect(
      placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        maxAmountCents: 3000,
      })
    ).rejects.toMatchObject({
      data: {
        code: "BAD_REQUEST",
      },
    })
  })

  test("uses start price as amount when only max is provided and no bids exist", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 1000,
    })
    const { ctx, events } = createMockMutationCtx()

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "s1" as BidIntentDoc["sponsorId"],
      maxAmountCents: 5000,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sponsorId: "s1",
      amountCents: 1000,
      isAuto: false,
    })
  })

  test("uses incremented minimum when bids already exist", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 1000,
    })
    const { ctx, events } = createMockMutationCtx([
      mockIntent({
        _id: "intent-existing" as BidIntentDoc["_id"],
        sponsorId: "s0" as BidIntentDoc["sponsorId"],
        amountCents: 1000,
        maxAmountCents: 1000,
        createdAt: Date.now() - 1000,
        _creationTime: Date.now() - 1000,
      }),
    ])

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "s1" as BidIntentDoc["sponsorId"],
      maxAmountCents: 5000,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sponsorId: "s1",
      amountCents: 1050,
      isAuto: false,
    })
  })

  test("collapses first bid to visible opening price", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 1000,
    })
    const { ctx, events } = createMockMutationCtx()

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "s1" as BidIntentDoc["sponsorId"],
      amountCents: 2000,
      maxAmountCents: 5000,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sponsorId: "s1",
      amountCents: 1000,
      isAuto: true,
    })
  })

  test("explicit bid from leader raises visible price", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 3100,
      currentLeaderSponsorId:
        "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 5000,
    })
    const { ctx, events } = createMockMutationCtx([
      mockIntent({
        _id: "intent-a" as BidIntentDoc["_id"],
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 3000,
        maxAmountCents: 5000,
        createdAt: Date.now() - 1000,
        _creationTime: Date.now() - 1000,
      }),
      mockIntent({
        _id: "intent-b" as BidIntentDoc["_id"],
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        mode: "manual",
        amountCents: 3000,
        maxAmountCents: 3000,
        createdAt: Date.now() - 900,
        _creationTime: Date.now() - 900,
      }),
    ])

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "sA" as BidIntentDoc["sponsorId"],
      amountCents: 4000,
      maxAmountCents: 9000,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sponsorId: "sA",
      amountCents: 4000,
      isAuto: false,
    })
  })

  test("does not emit event when leader raises max without explicit bid", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 3100,
      currentLeaderSponsorId:
        "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 5000,
    })
    const { ctx, events, patches } = createMockMutationCtx([
      mockIntent({
        _id: "intent-a" as BidIntentDoc["_id"],
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 3000,
        maxAmountCents: 5000,
        createdAt: Date.now() - 1000,
        _creationTime: Date.now() - 1000,
      }),
      mockIntent({
        _id: "intent-b" as BidIntentDoc["_id"],
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        mode: "manual",
        amountCents: 3000,
        maxAmountCents: 3000,
        createdAt: Date.now() - 900,
        _creationTime: Date.now() - 900,
      }),
    ])

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "sA" as BidIntentDoc["sponsorId"],
      maxAmountCents: 9000,
    })

    expect(events).toHaveLength(0)
    expect(patches[patches.length - 1]?.patch).toMatchObject({
      currentPriceCents: 3100,
      currentLeaderSponsorId: "sA",
      currentLeaderMaxCents: 9000,
    })
  })

  test("accepts explicit bid while already winning", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 3100,
      currentLeaderSponsorId:
        "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 5000,
    })
    const { ctx, events, patches, intents } = createMockMutationCtx([
      mockIntent({
        _id: "intent-a" as BidIntentDoc["_id"],
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 3000,
        maxAmountCents: 5000,
        createdAt: Date.now() - 1000,
        _creationTime: Date.now() - 1000,
      }),
      mockIntent({
        _id: "intent-b" as BidIntentDoc["_id"],
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        mode: "manual",
        amountCents: 3000,
        maxAmountCents: 3000,
        createdAt: Date.now() - 900,
        _creationTime: Date.now() - 900,
      }),
    ])

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "sA" as BidIntentDoc["sponsorId"],
      amountCents: 3200,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sponsorId: "sA",
      amountCents: 3200,
      isAuto: false,
    })
    expect(patches[patches.length - 1]?.patch).toMatchObject({
      currentPriceCents: 3200,
      currentLeaderSponsorId: "sA",
      currentLeaderMaxCents: 5000,
    })
    expect(intents[intents.length - 1]).toMatchObject({
      sponsorId: "sA",
      amountCents: 3200,
      maxAmountCents: 5000,
    })
  })

  test("leader max-only update in tied state does not create a visible bid jump", async () => {
    const auction = activeAuction({
      startPriceCents: 10_000,
      currentPriceCents: 20_000,
      currentLeaderSponsorId:
        "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 20_000,
    })
    const { ctx, events, patches, intents } = createMockMutationCtx([
      mockIntent({
        _id: "intent-a" as BidIntentDoc["_id"],
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 10_000,
        maxAmountCents: 20_000,
        createdAt: Date.now() - 1000,
        _creationTime: Date.now() - 1000,
      }),
      mockIntent({
        _id: "intent-b" as BidIntentDoc["_id"],
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 11_500,
        maxAmountCents: 20_000,
        createdAt: Date.now() - 900,
        _creationTime: Date.now() - 900,
      }),
    ])

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "sA" as BidIntentDoc["sponsorId"],
      maxAmountCents: 25_000,
    })

    expect(events).toHaveLength(0)
    expect(patches[patches.length - 1]?.patch).toMatchObject({
      currentPriceCents: 20_000,
      currentLeaderSponsorId: "sA",
      currentLeaderMaxCents: 25_000,
    })
    expect(intents[intents.length - 1]).toMatchObject({
      sponsorId: "sA",
      amountCents: 10_000,
      maxAmountCents: 25_000,
    })
  })

  test("amount-only bid preserves existing max for that sponsor", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 3100,
      currentLeaderSponsorId:
        "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 9000,
    })
    const { ctx, events, patches } = createMockMutationCtx([
      mockIntent({
        _id: "intent-a" as BidIntentDoc["_id"],
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 3000,
        maxAmountCents: 9000,
        createdAt: Date.now() - 1000,
        _creationTime: Date.now() - 1000,
      }),
      mockIntent({
        _id: "intent-b" as BidIntentDoc["_id"],
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 3000,
        maxAmountCents: 5000,
        createdAt: Date.now() - 900,
        _creationTime: Date.now() - 900,
      }),
    ])

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 3200,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sponsorId: "sA",
      amountCents: 5100,
      isAuto: true,
    })
    expect(patches[patches.length - 1]?.patch).toMatchObject({
      currentPriceCents: 5100,
      currentLeaderSponsorId: "sA",
      currentLeaderMaxCents: 9000,
    })
  })

  test("collapses challenger bid event to auto counter price when leader remains", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 1000,
      currentLeaderSponsorId:
        "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 5000,
    })
    const { ctx, events, patches } = createMockMutationCtx([
      mockIntent({
        _id: "intent-a" as BidIntentDoc["_id"],
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 2000,
        maxAmountCents: 5000,
        createdAt: Date.now() - 1000,
        _creationTime: Date.now() - 1000,
      }),
    ])

    const result = await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 2000,
      maxAmountCents: 2000,
    })

    expect(result.outbidSponsorId).toBe("sB")
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sponsorId: "sA",
      amountCents: 2050,
      isAuto: true,
    })
    expect(patches[patches.length - 1]?.patch.currentPriceCents).toBe(2050)
  })

  test("collapses challenger event when challenger wins above existing max", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 1000,
      currentLeaderSponsorId:
        "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 2000,
    })
    const { ctx, events, patches } = createMockMutationCtx([
      mockIntent({
        _id: "intent-a" as BidIntentDoc["_id"],
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 1050,
        maxAmountCents: 2000,
        createdAt: Date.now() - 1000,
        _creationTime: Date.now() - 1000,
      }),
    ])

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 1100,
      maxAmountCents: 2500,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sponsorId: "sB",
      amountCents: 2050,
      isAuto: true,
    })
    expect(patches[patches.length - 1]?.patch.currentPriceCents).toBe(2050)
  })

  test("collapses challenger event when challenger max is between current and leader max", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 1000,
      currentLeaderSponsorId:
        "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 2000,
    })
    const { ctx, events, patches } = createMockMutationCtx([
      mockIntent({
        _id: "intent-a" as BidIntentDoc["_id"],
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 1050,
        maxAmountCents: 2000,
        createdAt: Date.now() - 1000,
        _creationTime: Date.now() - 1000,
      }),
    ])

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 1100,
      maxAmountCents: 1250,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sponsorId: "sA",
      amountCents: 1300,
      isAuto: true,
    })
    expect(patches[patches.length - 1]?.patch.currentPriceCents).toBe(1300)
  })

  test("example 1: manual challenger does not expose intermediate bid amount", async () => {
    const firstAuction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: undefined,
    })
    const { ctx, events, patches } = createMockMutationCtx()
    await placeSponsorshipBid(ctx, {
      auction: firstAuction,
      sponsorId: "sA" as BidIntentDoc["sponsorId"],
      amountCents: 1050,
      maxAmountCents: 2000,
    })
    const secondAuction = withPatchedAuction(firstAuction, patches)
    const beforeSecond = events.length

    await placeSponsorshipBid(ctx, {
      auction: secondAuction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 1100,
    })

    const secondEvents = events.slice(beforeSecond)
    expect(secondEvents).toHaveLength(1)
    expect(secondEvents[0]?.amountCents).toBe(1150)
    expect(secondEvents.some((event) => event.amountCents === 1100)).toBe(false)
  })

  test("example 2: challenger proxy below leader max does not expose intermediate bid amount", async () => {
    const firstAuction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: undefined,
    })
    const { ctx, events, patches } = createMockMutationCtx()
    await placeSponsorshipBid(ctx, {
      auction: firstAuction,
      sponsorId: "sA" as BidIntentDoc["sponsorId"],
      amountCents: 1050,
      maxAmountCents: 2000,
    })
    const secondAuction = withPatchedAuction(firstAuction, patches)
    const beforeSecond = events.length

    await placeSponsorshipBid(ctx, {
      auction: secondAuction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 1100,
      maxAmountCents: 1250,
    })

    const secondEvents = events.slice(beforeSecond)
    expect(secondEvents).toHaveLength(1)
    expect(secondEvents[0]?.amountCents).toBe(1300)
    expect(secondEvents.some((event) => event.amountCents === 1100)).toBe(false)
  })

  test("example 3: challenger proxy above leader max does not expose intermediate bid amount", async () => {
    const firstAuction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: undefined,
    })
    const { ctx, events, patches } = createMockMutationCtx()
    await placeSponsorshipBid(ctx, {
      auction: firstAuction,
      sponsorId: "sA" as BidIntentDoc["sponsorId"],
      amountCents: 1050,
      maxAmountCents: 2000,
    })
    const secondAuction = withPatchedAuction(firstAuction, patches)
    const beforeSecond = events.length

    await placeSponsorshipBid(ctx, {
      auction: secondAuction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 1100,
      maxAmountCents: 2500,
    })

    const secondEvents = events.slice(beforeSecond)
    expect(secondEvents).toHaveLength(1)
    expect(secondEvents[0]?.amountCents).toBe(2050)
    expect(secondEvents.some((event) => event.amountCents === 1100)).toBe(false)
  })

  test("does not expose challenger tie bid when challenging an existing leader", async () => {
    const firstAuction = activeAuction({
      startPriceCents: 10_000,
      currentPriceCents: undefined,
    })
    const { ctx, events, patches } = createMockMutationCtx()

    await placeSponsorshipBid(ctx, {
      auction: firstAuction,
      sponsorId: "sA" as BidIntentDoc["sponsorId"],
      amountCents: 10_000,
      maxAmountCents: 20_000,
    })
    let latestAuction = withPatchedAuction(firstAuction, patches)

    const beforeSecond = events.length
    await placeSponsorshipBid(ctx, {
      auction: latestAuction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 11_500,
    })
    const secondEvents = events.slice(beforeSecond)
    expect(secondEvents).toHaveLength(1)
    expect(secondEvents[0]).toMatchObject({
      sponsorId: "sA",
      amountCents: 11_750,
      isAuto: true,
    })
    latestAuction = withPatchedAuction(latestAuction, patches)

    const beforeThird = events.length
    await placeSponsorshipBid(ctx, {
      auction: latestAuction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 12_000,
      maxAmountCents: 15_000,
    })
    const thirdEvents = events.slice(beforeThird)
    expect(thirdEvents).toHaveLength(1)
    expect(thirdEvents[0]).toMatchObject({
      sponsorId: "sA",
      amountCents: 15_250,
      isAuto: true,
    })
    latestAuction = withPatchedAuction(latestAuction, patches)

    const beforeFourth = events.length
    await placeSponsorshipBid(ctx, {
      auction: latestAuction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 20_000,
    })
    const fourthEvents = events.slice(beforeFourth)
    expect(fourthEvents).toHaveLength(1)
    expect(fourthEvents[0]).toMatchObject({
      sponsorId: "sA",
      amountCents: 20_000,
      isAuto: true,
    })
    expect(fourthEvents.some((event) => event.sponsorId === "sB")).toBe(false)
  })

  test("keeps explicit winning bid visible when challenger wins at exact amount", async () => {
    const auction = activeAuction({
      startPriceCents: 1000,
      currentPriceCents: 1000,
      currentLeaderSponsorId:
        "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 2000,
    })
    const { ctx, events } = createMockMutationCtx([
      mockIntent({
        _id: "intent-a" as BidIntentDoc["_id"],
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 1050,
        maxAmountCents: 2000,
        createdAt: Date.now() - 1000,
        _creationTime: Date.now() - 1000,
      }),
    ])

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 2050,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sponsorId: "sB",
      amountCents: 2050,
      isAuto: false,
    })
  })

  test("equal max tie prefers sponsor who first set that max, not first-ever bidder", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    let now = 1_700_000_100_000
    nowSpy.mockImplementation(() => now++)
    try {
      const firstAuction = activeAuction({
        startPriceCents: 10_000,
        currentPriceCents: undefined,
      })
      const { ctx, events, patches } = createMockMutationCtx()

      await placeSponsorshipBid(ctx, {
        auction: firstAuction,
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        amountCents: 10_000,
        maxAmountCents: 15_000,
      })
      let latestAuction = withPatchedAuction(firstAuction, patches)

      await placeSponsorshipBid(ctx, {
        auction: latestAuction,
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        amountCents: 11_000,
        maxAmountCents: 20_000,
      })
      latestAuction = withPatchedAuction(latestAuction, patches)
      const beforeThird = events.length

      await placeSponsorshipBid(ctx, {
        auction: latestAuction,
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        amountCents: 15_500,
        maxAmountCents: 20_000,
      })

      const thirdEvents = events.slice(beforeThird)
      expect(thirdEvents).toHaveLength(1)
      expect(thirdEvents[0]).toMatchObject({
        sponsorId: "sB",
        amountCents: 20_000,
        isAuto: true,
      })
      expect(patches[patches.length - 1]?.patch).toMatchObject({
        currentPriceCents: 20_000,
        currentLeaderSponsorId: "sB",
        currentLeaderMaxCents: 20_000,
      })
    } finally {
      nowSpy.mockRestore()
    }
  })

  test("equal max challenge keeps first bidder winning at tied max", async () => {
    const fixedNow = 1_700_000_000_000
    const auction = activeAuction({
      startPriceCents: 10_000,
      currentPriceCents: 10_000,
      currentLeaderSponsorId:
        "sB" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 20_000,
    })
    const { ctx, events, patches } = createMockMutationCtx([
      mockIntent({
        _id: "intent-0" as BidIntentDoc["_id"],
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 10_000,
        maxAmountCents: 20_000,
        createdAt: fixedNow,
        _creationTime: fixedNow,
      }),
    ])
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(fixedNow)
    try {
      await placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        amountCents: 11_000,
        maxAmountCents: 20_000,
      })
    } finally {
      nowSpy.mockRestore()
    }

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sponsorId: "sB",
      amountCents: 20_000,
      isAuto: true,
    })
    expect(patches[patches.length - 1]?.patch).toMatchObject({
      currentPriceCents: 20_000,
      currentLeaderSponsorId: "sB",
      currentLeaderMaxCents: 20_000,
    })
  })

  test("sealed auctions reject max-only submissions", async () => {
    const auction = activeAuction({
      framework: "first_sealed",
      startPriceCents: 10_000,
      currentPriceCents: undefined,
    })
    const { ctx } = createMockMutationCtx()

    await expect(
      placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "s1" as BidIntentDoc["sponsorId"],
        maxAmountCents: 20_000,
      })
    ).rejects.toMatchObject({
      data: {
        code: "BAD_REQUEST",
      },
    })
  })

  test("sealed auctions update leader without emitting bid events", async () => {
    const auction = activeAuction({
      framework: "first_sealed",
      startPriceCents: 10_000,
      currentPriceCents: undefined,
    })
    const { ctx, events, patches } = createMockMutationCtx()

    const result = await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "s1" as BidIntentDoc["sponsorId"],
      amountCents: 12_000,
    })

    expect(result).toEqual({ currentPriceCents: 10_000 })
    expect(events).toHaveLength(0)
    expect(patches[patches.length - 1]?.patch).toMatchObject({
      currentPriceCents: 12_000,
      currentLeaderSponsorId: "s1",
      currentLeaderMaxCents: 12_000,
    })
    expect(patches[patches.length - 1]?.patch.endsAt).toBeUndefined()
  })

  test("sealed auctions allow lowering your own bid because latest bid is final", async () => {
    const now = Date.now()
    const auction = activeAuction({
      framework: "first_sealed",
      startPriceCents: 10_000,
      currentPriceCents: 20_000,
      currentLeaderSponsorId:
        "s1" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 20_000,
    })
    const { ctx, events, patches, intents } = createMockMutationCtx([
      mockIntent({
        _id: "intent-old" as BidIntentDoc["_id"],
        sponsorId: "s1" as BidIntentDoc["sponsorId"],
        amountCents: 20_000,
        maxAmountCents: 20_000,
        createdAt: now - 1_000,
        _creationTime: now - 1_000,
      }),
    ])

    const result = await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "s1" as BidIntentDoc["sponsorId"],
      amountCents: 15_000,
    })

    expect(result).toEqual({ currentPriceCents: 10_000 })
    expect(events).toHaveLength(0)
    expect(intents[intents.length - 1]).toMatchObject({
      sponsorId: "s1",
      amountCents: 15_000,
      maxAmountCents: 15_000,
    })
    expect(patches[patches.length - 1]?.patch).toMatchObject({
      currentPriceCents: 15_000,
      currentLeaderSponsorId: "s1",
      currentLeaderMaxCents: 15_000,
    })
  })

  test("sealed auctions use latest submission per sponsor and earlier tie wins", async () => {
    const now = Date.now()
    const auction = activeAuction({
      framework: "first_sealed",
      startPriceCents: 10_000,
      currentPriceCents: 20_000,
      currentLeaderSponsorId:
        "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
      currentLeaderMaxCents: 20_000,
    })
    const { ctx, patches } = createMockMutationCtx([
      mockIntent({
        _id: "intent-a-1" as BidIntentDoc["_id"],
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        amountCents: 20_000,
        maxAmountCents: 20_000,
        createdAt: now - 2_000,
        _creationTime: now - 2_000,
      }),
      mockIntent({
        _id: "intent-b-1" as BidIntentDoc["_id"],
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        amountCents: 19_000,
        maxAmountCents: 19_000,
        createdAt: now - 1_000,
        _creationTime: now - 1_000,
      }),
    ])

    await placeSponsorshipBid(ctx, {
      auction,
      sponsorId: "sB" as BidIntentDoc["sponsorId"],
      amountCents: 20_000,
    })

    expect(patches[patches.length - 1]?.patch).toMatchObject({
      currentPriceCents: 20_000,
      currentLeaderSponsorId: "sA",
      currentLeaderMaxCents: 20_000,
    })

    const afterTieAuction = withPatchedAuction(auction, patches)
    await placeSponsorshipBid(ctx, {
      auction: afterTieAuction,
      sponsorId: "sA" as BidIntentDoc["sponsorId"],
      amountCents: 15_000,
    })

    expect(patches[patches.length - 1]?.patch).toMatchObject({
      currentPriceCents: 20_000,
      currentLeaderSponsorId: "sB",
      currentLeaderMaxCents: 20_000,
    })
  })

  describe("outbidSponsorId in result", () => {
    test("first bid returns no outbidSponsorId", async () => {
      const auction = activeAuction({
        startPriceCents: 1000,
        currentPriceCents: undefined,
        currentLeaderSponsorId: undefined,
      })
      const { ctx } = createMockMutationCtx()

      const result = await placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        amountCents: 1000,
      })

      expect(result.outbidSponsorId).toBeUndefined()
    })

    test("self-bump returns no outbidSponsorId", async () => {
      const auction = activeAuction({
        startPriceCents: 1000,
        currentPriceCents: 1000,
        currentLeaderSponsorId:
          "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
        currentLeaderMaxCents: 1000,
      })
      const { ctx } = createMockMutationCtx([
        mockIntent({
          _id: "intent-a" as BidIntentDoc["_id"],
          sponsorId: "sA" as BidIntentDoc["sponsorId"],
          amountCents: 1000,
          maxAmountCents: 1000,
          createdAt: Date.now() - 1000,
          _creationTime: Date.now() - 1000,
        }),
      ])

      const result = await placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        amountCents: 2000,
        maxAmountCents: 5000,
      })

      expect(result.outbidSponsorId).toBeUndefined()
    })

    test("leadership change returns previous leader as outbidSponsorId", async () => {
      const auction = activeAuction({
        startPriceCents: 1000,
        currentPriceCents: 1000,
        currentLeaderSponsorId:
          "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
        currentLeaderMaxCents: 2000,
      })
      const { ctx } = createMockMutationCtx([
        mockIntent({
          _id: "intent-a" as BidIntentDoc["_id"],
          sponsorId: "sA" as BidIntentDoc["sponsorId"],
          amountCents: 1000,
          maxAmountCents: 2000,
          createdAt: Date.now() - 1000,
          _creationTime: Date.now() - 1000,
        }),
      ])

      const result = await placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        amountCents: 1100,
        maxAmountCents: 3000,
      })

      expect(result.outbidSponsorId).toBe("sA")
    })

    test("incumbent proxy retains lead — outbid sponsor is challenger", async () => {
      const auction = activeAuction({
        startPriceCents: 1000,
        currentPriceCents: 1000,
        currentLeaderSponsorId:
          "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
        currentLeaderMaxCents: 5000,
      })
      const { ctx } = createMockMutationCtx([
        mockIntent({
          _id: "intent-a" as BidIntentDoc["_id"],
          sponsorId: "sA" as BidIntentDoc["sponsorId"],
          mode: "proxy",
          amountCents: 2000,
          maxAmountCents: 5000,
          createdAt: Date.now() - 1000,
          _creationTime: Date.now() - 1000,
        }),
      ])

      const result = await placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        amountCents: 2000,
        maxAmountCents: 2000,
      })

      expect(result.outbidSponsorId).toBe("sB")
    })

    test("sealed auction returns no outbidSponsorId", async () => {
      const auction = activeAuction({
        framework: "first_sealed",
        startPriceCents: 10_000,
        currentPriceCents: undefined,
        currentLeaderSponsorId: undefined,
      })
      const { ctx } = createMockMutationCtx()

      const result = await placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        amountCents: 12_000,
      })

      expect(result.outbidSponsorId).toBeUndefined()
    })

    test("leadership change with anti-sniping returns both outbidSponsorId and extendedEndsAt", async () => {
      const now = Date.now()
      const auction = activeAuction({
        startPriceCents: 1000,
        currentPriceCents: 1000,
        currentLeaderSponsorId:
          "sA" as Doc<"sponsorshipAuctions">["currentLeaderSponsorId"],
        currentLeaderMaxCents: 2000,
        endsAt: now + 60_000,
        antiSnipingWindowMs: 5 * 60_000,
        antiSnipingExtendMs: 5 * 60_000,
      })
      const { ctx } = createMockMutationCtx([
        mockIntent({
          _id: "intent-a" as BidIntentDoc["_id"],
          sponsorId: "sA" as BidIntentDoc["sponsorId"],
          amountCents: 1000,
          maxAmountCents: 2000,
          createdAt: now - 1000,
          _creationTime: now - 1000,
        }),
      ])

      const result = await placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "sB" as BidIntentDoc["sponsorId"],
        amountCents: 1100,
        maxAmountCents: 3000,
      })

      expect(result.outbidSponsorId).toBe("sA")
      expect(result.extendedEndsAt).toBe(now + 60_000 + 5 * 60_000)
    })
  })

  describe("anti-sniping extension", () => {
    test("bid within sniping window returns extendedEndsAt", async () => {
      const now = Date.now()
      const auction = activeAuction({
        startPriceCents: 1000,
        currentPriceCents: undefined,
        endsAt: now + 60_000,
        antiSnipingWindowMs: 5 * 60_000,
        antiSnipingExtendMs: 5 * 60_000,
      })
      const { ctx } = createMockMutationCtx()

      const result = await placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        amountCents: 1000,
      })

      expect(result.extendedEndsAt).toBe(now + 60_000 + 5 * 60_000)
    })

    test("bid outside sniping window does not return extendedEndsAt", async () => {
      const now = Date.now()
      const auction = activeAuction({
        startPriceCents: 1000,
        currentPriceCents: undefined,
        endsAt: now + 10 * 60_000,
        antiSnipingWindowMs: 5 * 60_000,
        antiSnipingExtendMs: 5 * 60_000,
      })
      const { ctx } = createMockMutationCtx()

      const result = await placeSponsorshipBid(ctx, {
        auction,
        sponsorId: "sA" as BidIntentDoc["sponsorId"],
        amountCents: 1000,
      })

      expect(result.extendedEndsAt).toBeUndefined()
    })
  })
})
