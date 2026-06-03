import { describe, expect, test } from "vitest"
import type { Doc } from "@/convex/_generated/dataModel"
import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  placeBidHandler,
  setMaxBidHandler,
  sponsorBidEventLabel,
} from "./auctions"

type AuctionDoc = Doc<"sponsorshipAuctions">
type IntentDoc = Doc<"sponsorshipBidIntents">

function makeAuction(overrides: Partial<AuctionDoc> = {}): AuctionDoc {
  const now = Date.now()
  return {
    _id: "auction1" as AuctionDoc["_id"],
    _creationTime: now,
    competitionId: "comp1" as AuctionDoc["competitionId"],
    framework: "first_sealed",
    state: "active",
    currency: "EUR",
    startsAt: now - 60_000,
    endsAt: now + 60_000,
    antiSnipingWindowMs: 5 * 60_000,
    antiSnipingExtendMs: 5 * 60_000,
    startPriceCents: 10_000,
    currentPriceCents: undefined,
    currentLeaderSponsorId: undefined,
    currentLeaderMaxCents: undefined,
    winnerSponsorId: undefined,
    winningBidId: undefined,
    settlementAmountCents: undefined,
    readinessSnapshotJson: undefined,
    createdById: "u1" as AuctionDoc["createdById"],
    updatedById: "u1" as AuctionDoc["updatedById"],
    updatedAt: now,
    ...overrides,
  }
}

function makePortalCtx(input: { auction: AuctionDoc; intents?: IntentDoc[] }) {
  const intents = [...(input.intents ?? [])]
  const patches: Partial<AuctionDoc>[] = []
  const now = Date.now()
  const sponsorId = "sponsor1"
  const authUserId = "auth-user-1"
  const primaryContact = {
    _id: "contact-1" as Id<"sponsorContacts">,
    _creationTime: now,
    sponsorId: sponsorId as Id<"sponsors">,
    name: "Sponsor",
    email: "sponsor@example.com",
    emailNormalized: "sponsor@example.com",
    authUserId,
    active: true,
    isPrimary: true,
    receivesCc: false,
    portalAccess: true,
    canBid: true,
    createdById: "u1" as Id<"users">,
    updatedById: "u1" as Id<"users">,
    updatedAt: now,
  }

  const ctx = {
    runQuery: async (_ref: unknown, args: Record<string, unknown>) => {
      if (args.model === "session") {
        return {
          _id: "session-1",
          token: "session-token",
          userId: authUserId,
          expiresAt: now + 60_000,
          createdAt: now - 10_000,
          updatedAt: now - 10_000,
        }
      }
      if (args.model === "user") {
        return {
          _id: authUserId,
          email: "sponsor@example.com",
          name: "Sponsor",
          emailVerified: true,
          createdAt: now - 10_000,
          updatedAt: now - 10_000,
        }
      }
      throw new Error(`Unexpected model: ${String(args.model)}`)
    },
    db: {
      query: (table: string) => {
        if (table === "sponsorContacts") {
          return {
            withIndex: () => ({
              unique: async () => primaryContact,
              collect: async () => [primaryContact],
            }),
          }
        }
        if (table === "sponsors") {
          return {
            withIndex: () => ({
              unique: async () => ({
                _id: sponsorId,
                name: "Sponsor",
                email: "sponsor@example.com",
                emailNormalized: "sponsor@example.com",
                avatarUrl: undefined,
                authUserId,
                lastAccessEmailSentAt: undefined,
                active: true,
                createdById: "u1",
                updatedById: "u1",
                updatedAt: now,
              }),
            }),
          }
        }
        if (table === "sponsorshipAuctionInvites") {
          return {
            withIndex: () => ({
              unique: async () => ({
                _id: "invite-1",
                auctionId: input.auction._id,
                sponsorId,
                invitedById: "u1",
                invitedAt: now,
                inviteSentAt: undefined,
                _creationTime: now,
              }),
            }),
          }
        }
        if (table === "sponsorshipBidIntents") {
          return {
            withIndex: () => ({
              collect: async () => intents,
            }),
          }
        }
        throw new Error(`Unexpected query table: ${table}`)
      },
      get: async (table: string, id: string) => {
        if (table === "sponsorshipAuctions" && id === input.auction._id) {
          return input.auction
        }
        if (table === "sponsors" && id === sponsorId) {
          return {
            _id: sponsorId,
            name: "Sponsor",
            email: "sponsor@example.com",
            emailNormalized: "sponsor@example.com",
            avatarUrl: undefined,
            authUserId,
            lastAccessEmailSentAt: undefined,
            active: true,
            createdById: "u1",
            updatedById: "u1",
            updatedAt: now,
          }
        }
        return null
      },
      insert: async (table: string, value: Record<string, unknown>) => {
        if (table !== "sponsorshipBidIntents") {
          throw new Error(`Unexpected insert table: ${table}`)
        }
        const intent: IntentDoc = {
          _id: `intent-${String(intents.length + 1)}` as IntentDoc["_id"],
          _creationTime: now,
          auctionId: input.auction._id,
          sponsorId: value.sponsorId as IntentDoc["sponsorId"],
          mode: value.mode as IntentDoc["mode"],
          amountCents: value.amountCents as number,
          maxAmountCents: value.maxAmountCents as number | undefined,
          isValid: true,
          createdAt: value.createdAt as number,
        }
        intents.push(intent)
        return intent._id
      },
      patch: async (table: string, _id: string, patch: Partial<AuctionDoc>) => {
        if (table !== "sponsorshipAuctions") {
          throw new Error(`Unexpected patch table: ${table}`)
        }
        patches.push(patch)
      },
    },
  } as unknown as MutationCtx

  return { ctx, patches, sponsorId }
}

function makeProxyPortalCtx(input: {
  auction: AuctionDoc
  competitionName?: string
  leaderSponsorId?: string
  leaderIntent?: IntentDoc
}) {
  const intents: IntentDoc[] = input.leaderIntent ? [input.leaderIntent] : []
  const patches: Partial<AuctionDoc>[] = []
  const scheduledCalls: {
    delayMs?: number
    scheduledTime?: number
    args: unknown
  }[] = []
  const now = Date.now()
  const sponsorId = "sponsor1"
  const authUserId = "auth-user-1"
  const primaryContact = {
    _id: "contact-1" as Id<"sponsorContacts">,
    _creationTime: now,
    sponsorId: sponsorId as Id<"sponsors">,
    name: "Sponsor",
    email: "sponsor@example.com",
    emailNormalized: "sponsor@example.com",
    authUserId,
    active: true,
    isPrimary: true,
    receivesCc: false,
    portalAccess: true,
    canBid: true,
    createdById: "u1" as Id<"users">,
    updatedById: "u1" as Id<"users">,
    updatedAt: now,
  }

  const ctx = {
    runQuery: async (_ref: unknown, args: Record<string, unknown>) => {
      if (args.model === "session") {
        return {
          _id: "session-1",
          token: "session-token",
          userId: authUserId,
          expiresAt: now + 60_000,
          createdAt: now - 10_000,
          updatedAt: now - 10_000,
        }
      }
      if (args.model === "user") {
        return {
          _id: authUserId,
          email: "sponsor@example.com",
          name: "Sponsor",
          emailVerified: true,
          createdAt: now - 10_000,
          updatedAt: now - 10_000,
        }
      }
      throw new Error(`Unexpected model: ${String(args.model)}`)
    },
    db: {
      query: (table: string) => {
        if (table === "sponsorContacts") {
          return {
            withIndex: () => ({
              unique: async () => primaryContact,
              collect: async () => [primaryContact],
            }),
          }
        }
        if (table === "sponsors") {
          return {
            withIndex: () => ({
              unique: async () => ({
                _id: sponsorId,
                name: "Sponsor",
                email: "sponsor@example.com",
                emailNormalized: "sponsor@example.com",
                active: true,
                createdById: "u1",
                updatedById: "u1",
                updatedAt: now,
              }),
            }),
          }
        }
        if (table === "sponsorshipAuctionInvites") {
          return {
            withIndex: () => ({
              unique: async () => ({
                _id: "invite-1",
                auctionId: input.auction._id,
                sponsorId,
                invitedById: "u1",
                invitedAt: now,
                _creationTime: now,
              }),
            }),
          }
        }
        if (table === "sponsorshipBidIntents") {
          return {
            withIndex: () => ({
              collect: async () => intents,
            }),
          }
        }
        if (table === "sponsorshipAuctionOutbidNotices") {
          return {
            withIndex: () => ({
              order: () => ({
                first: async () => null,
              }),
            }),
          }
        }
        if (table === "sponsorshipAuctionReminders") {
          return {
            withIndex: () => ({
              collect: async () => [],
            }),
          }
        }
        throw new Error(`Unexpected query table: ${table}`)
      },
      get: async (table: string, id: string) => {
        if (table === "sponsorshipAuctions") return input.auction
        if (table === "sponsors" && id === sponsorId) {
          return {
            _id: sponsorId,
            name: "Sponsor",
            email: "sponsor@example.com",
            emailNormalized: "sponsor@example.com",
            active: true,
            createdById: "u1",
            updatedById: "u1",
            updatedAt: now,
          }
        }
        if (table === "sponsors" && id === input.leaderSponsorId) {
          return {
            _id: input.leaderSponsorId,
            name: "Leader Sponsor",
            email: "leader@example.com",
            emailNormalized: "leader@example.com",
            active: true,
            createdById: "u1",
            updatedById: "u1",
            updatedAt: now,
          }
        }
        if (table === "competitions") {
          return {
            _id: input.auction.competitionId,
            name: input.competitionName ?? "Test Competition",
            description: null,
            people: {
              compLead: null,
              leadDelegate: null,
              organisers: [],
            },
            compDates: {
              from: "2026-09-01",
              to: "2026-09-02",
            },
            phaseId: null,
            updateId: null,
          }
        }
        return null
      },
      insert: async (table: string, value: Record<string, unknown>) => {
        if (table === "sponsorshipBidIntents") {
          const intent: IntentDoc = {
            _id: `intent-${String(intents.length + 1)}` as IntentDoc["_id"],
            _creationTime: now,
            auctionId: input.auction._id,
            sponsorId: value.sponsorId as IntentDoc["sponsorId"],
            mode: value.mode as IntentDoc["mode"],
            amountCents: value.amountCents as number,
            maxAmountCents: value.maxAmountCents as number | undefined,
            isValid: true,
            createdAt: value.createdAt as number,
          }
          intents.push(intent)
          return intent._id
        }
        if (table === "sponsorshipAuctionOutbidNotices") {
          return "notice-1" as Id<"sponsorshipAuctionOutbidNotices">
        }
        if (table === "sponsorshipBidEvents") {
          return "event-1" as Id<"sponsorshipBidEvents">
        }
        throw new Error(`Unexpected insert table: ${table}`)
      },
      patch: async (table: string, _id: string, patch: Partial<AuctionDoc>) => {
        if (table !== "sponsorshipAuctions") {
          throw new Error(`Unexpected patch table: ${table}`)
        }
        patches.push(patch)
        Object.assign(input.auction, patch)
      },
    },
    scheduler: {
      cancel: async () => undefined,
      runAfter: async (delayMs: number, _fnRef: unknown, args: unknown) => {
        scheduledCalls.push({ delayMs, args })
      },
      runAt: async (scheduledTime: number, _fnRef: unknown, args: unknown) => {
        scheduledCalls.push({ scheduledTime, args })
        return "scheduled-close-1"
      },
    },
  } as unknown as MutationCtx

  return { ctx, patches, scheduledCalls, sponsorId }
}

describe("sponsor portal auction mutations", () => {
  test("setMaxBid rejects sealed auctions", async () => {
    const auction = makeAuction({ framework: "first_sealed" })
    const { ctx } = makePortalCtx({
      auction,
    })

    await expect(
      setMaxBidHandler(ctx, {
        sessionToken: "session-token",
        auctionId: auction._id,
        maxAmountCents: 20_000,
      })
    ).rejects.toMatchObject({
      data: {
        code: "BAD_REQUEST",
        message: "Max bids are only available for Proxy Bidding auctions.",
      },
    })
  })

  test("placeBid accepts sealed auction bids", async () => {
    const auction = makeAuction({ framework: "first_sealed" })
    const { ctx, patches, sponsorId } = makePortalCtx({
      auction,
    })

    const result = await placeBidHandler(ctx, {
      sessionToken: "session-token",
      auctionId: auction._id,
      amountCents: 12_000,
    })

    expect(result).toEqual({ currentPriceCents: 10_000 })
    expect(patches[patches.length - 1]).toMatchObject({
      currentPriceCents: 12_000,
      currentLeaderSponsorId: sponsorId,
      currentLeaderMaxCents: 12_000,
    })
  })

  test("placeBid allows lowering existing sealed bid because latest bid is used", async () => {
    const now = Date.now()
    const auction = makeAuction({
      framework: "first_sealed",
      currentPriceCents: 20_000,
      currentLeaderSponsorId:
        "sponsor1" as AuctionDoc["currentLeaderSponsorId"],
      currentLeaderMaxCents: 20_000,
    })
    const { ctx, patches, sponsorId } = makePortalCtx({
      auction,
      intents: [
        {
          _id: "intent-old" as IntentDoc["_id"],
          _creationTime: now - 1_000,
          auctionId: auction._id,
          sponsorId: "sponsor1" as IntentDoc["sponsorId"],
          mode: "manual",
          amountCents: 20_000,
          maxAmountCents: 20_000,
          isValid: true,
          createdAt: now - 1_000,
        },
      ],
    })

    const result = await placeBidHandler(ctx, {
      sessionToken: "session-token",
      auctionId: auction._id,
      amountCents: 15_000,
    })

    expect(result).toEqual({ currentPriceCents: 10_000 })
    expect(patches[patches.length - 1]).toMatchObject({
      currentPriceCents: 15_000,
      currentLeaderSponsorId: sponsorId,
      currentLeaderMaxCents: 15_000,
    })
  })
})

describe("proxy bid outbid email with anti-sniping", () => {
  test("placeBid within sniping window that displaces leader sends email with extended endsAt", async () => {
    const now = Date.now()
    const leaderSponsorId = "leader-sponsor"
    const originalEndsAt = now + 60_000
    const antiSnipingExtendMs = 5 * 60_000

    const auction = makeAuction({
      framework: "ebay_proxy",
      startPriceCents: 1000,
      currentPriceCents: 1000,
      currentLeaderSponsorId:
        leaderSponsorId as AuctionDoc["currentLeaderSponsorId"],
      currentLeaderMaxCents: 2000,
      endsAt: originalEndsAt,
      antiSnipingWindowMs: 5 * 60_000,
      antiSnipingExtendMs,
    })

    const { ctx, scheduledCalls } = makeProxyPortalCtx({
      auction,
      leaderSponsorId,
      competitionName: "Irish Open 2026",
      leaderIntent: {
        _id: "intent-leader" as IntentDoc["_id"],
        _creationTime: now - 1000,
        auctionId: auction._id,
        sponsorId: leaderSponsorId as IntentDoc["sponsorId"],
        mode: "manual",
        amountCents: 1000,
        maxAmountCents: 2000,
        isValid: true,
        createdAt: now - 1000,
      },
    })

    const result = await placeBidHandler(ctx, {
      sessionToken: "session-token",
      auctionId: auction._id,
      amountCents: 2100,
    })

    expect(result.extendedEndsAt).toBe(originalEndsAt + antiSnipingExtendMs)

    const outbidEmail = scheduledCalls.find((call) => {
      const args = call.args as { emailType?: string }
      return args.emailType === "auction_ebay_outbid"
    })
    expect(outbidEmail).toBeDefined()
    const emailArgs = outbidEmail?.args as {
      context: { endsAt: number }
      recipients: { sponsorId: string }[]
    }
    expect(emailArgs.context.endsAt).toBe(originalEndsAt + antiSnipingExtendMs)
    expect(emailArgs.recipients[0]?.sponsorId).toBe(leaderSponsorId)

    const closureJob = scheduledCalls.find((call) => {
      const args = call.args as { auctionId?: string }
      return args.auctionId === auction._id
    })
    expect(closureJob?.scheduledTime).toBe(originalEndsAt + antiSnipingExtendMs)
  })

  test("setMaxBid outside sniping window that displaces leader sends email with original endsAt", async () => {
    const now = Date.now()
    const leaderSponsorId = "leader-sponsor"
    const originalEndsAt = now + 10 * 60_000

    const auction = makeAuction({
      framework: "ebay_proxy",
      startPriceCents: 1000,
      currentPriceCents: 1000,
      currentLeaderSponsorId:
        leaderSponsorId as AuctionDoc["currentLeaderSponsorId"],
      currentLeaderMaxCents: 2000,
      endsAt: originalEndsAt,
      antiSnipingWindowMs: 5 * 60_000,
      antiSnipingExtendMs: 5 * 60_000,
    })

    const { ctx, scheduledCalls } = makeProxyPortalCtx({
      auction,
      leaderSponsorId,
      leaderIntent: {
        _id: "intent-leader" as IntentDoc["_id"],
        _creationTime: now - 1000,
        auctionId: auction._id,
        sponsorId: leaderSponsorId as IntentDoc["sponsorId"],
        mode: "manual",
        amountCents: 1000,
        maxAmountCents: 2000,
        isValid: true,
        createdAt: now - 1000,
      },
    })

    const result = await setMaxBidHandler(ctx, {
      sessionToken: "session-token",
      auctionId: auction._id,
      maxAmountCents: 3000,
    })

    expect(result.extendedEndsAt).toBeUndefined()

    const outbidEmail = scheduledCalls.find((call) => {
      const args = call.args as { emailType?: string }
      return args.emailType === "auction_ebay_outbid"
    })
    expect(outbidEmail).toBeDefined()
    const emailArgs = outbidEmail?.args as { context: { endsAt: number } }
    expect(emailArgs.context.endsAt).toBe(originalEndsAt)
  })

  test("placeBid loses to incumbent automatic proxy — outbid email goes to challenger", async () => {
    const now = Date.now()
    const leaderSponsorId = "leader-sponsor"
    const originalEndsAt = now + 10 * 60_000

    const auction = makeAuction({
      framework: "ebay_proxy",
      startPriceCents: 1000,
      currentPriceCents: 1000,
      currentLeaderSponsorId:
        leaderSponsorId as AuctionDoc["currentLeaderSponsorId"],
      currentLeaderMaxCents: 5000,
      endsAt: originalEndsAt,
      antiSnipingWindowMs: 5 * 60_000,
      antiSnipingExtendMs: 5 * 60_000,
    })

    const { ctx, scheduledCalls, sponsorId } = makeProxyPortalCtx({
      auction,
      leaderSponsorId,
      leaderIntent: {
        _id: "intent-leader" as IntentDoc["_id"],
        _creationTime: now - 1000,
        auctionId: auction._id,
        sponsorId: leaderSponsorId as IntentDoc["sponsorId"],
        mode: "proxy",
        amountCents: 2000,
        maxAmountCents: 5000,
        isValid: true,
        createdAt: now - 1000,
      },
    })

    await placeBidHandler(ctx, {
      sessionToken: "session-token",
      auctionId: auction._id,
      amountCents: 2000,
    })

    const outbidEmail = scheduledCalls.find((call) => {
      const args = call.args as { emailType?: string }
      return args.emailType === "auction_ebay_outbid"
    })
    expect(outbidEmail).toBeDefined()
    const emailArgs = outbidEmail?.args as {
      recipients: { sponsorId: string }[]
    }
    expect(emailArgs.recipients[0]?.sponsorId).toBe(sponsorId)
  })
})

describe("sponsor bid event labels", () => {
  const selfSponsorId = "sponsor-self" as Id<"sponsors">

  test("uses one shared label for all non-self bidders", () => {
    expect(
      sponsorBidEventLabel({
        eventSponsorId: "sponsor-a" as Id<"sponsors">,
        currentSponsorId: selfSponsorId,
      })
    ).toBe("Bidder")
    expect(
      sponsorBidEventLabel({
        eventSponsorId: "sponsor-a" as Id<"sponsors">,
        currentSponsorId: selfSponsorId,
      })
    ).toBe("Bidder")
    expect(
      sponsorBidEventLabel({
        eventSponsorId: "sponsor-b" as Id<"sponsors">,
        currentSponsorId: selfSponsorId,
      })
    ).toBe("Bidder")
    expect(
      sponsorBidEventLabel({
        eventSponsorId: selfSponsorId,
        currentSponsorId: selfSponsorId,
      })
    ).toBe("You")
    expect(
      sponsorBidEventLabel({
        eventSponsorId: undefined,
        currentSponsorId: selfSponsorId,
      })
    ).toBe("System")
  })

  test("label stream is identical for one external bidder vs multiple bidders", () => {
    const oneBidderSequence = ["sponsor-a", "sponsor-a", "sponsor-a"] as const
    const twoBidderSequence = ["sponsor-a", "sponsor-b", "sponsor-a"] as const

    const oneBidderLabels = oneBidderSequence.map((sponsorId) =>
      sponsorBidEventLabel({
        eventSponsorId: sponsorId as Id<"sponsors">,
        currentSponsorId: selfSponsorId,
      })
    )
    const twoBidderLabels = twoBidderSequence.map((sponsorId) =>
      sponsorBidEventLabel({
        eventSponsorId: sponsorId as Id<"sponsors">,
        currentSponsorId: selfSponsorId,
      })
    )

    expect(oneBidderLabels).toEqual(["Bidder", "Bidder", "Bidder"])
    expect(twoBidderLabels).toEqual(["Bidder", "Bidder", "Bidder"])
    expect(oneBidderLabels).toEqual(twoBidderLabels)
  })
})
