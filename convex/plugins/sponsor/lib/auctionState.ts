import type { Doc, Id } from "@/convex/_generated/dataModel"
import { resolveProxyState, resolveSealedOutcome } from "./bidding"
import {
  isProxyAuctionFramework,
  sealedAuctionPricingRule,
} from "@/convex/plugins/sponsor/lib/types"

type AuctionDoc = Doc<"sponsorshipAuctions">
type IntentDoc = Doc<"sponsorshipBidIntents">

const emptyBidState = {
  currentPriceCents: undefined,
  currentLeaderSponsorId: undefined,
  currentLeaderMaxCents: undefined,
} as const

export type AuctionOutcome =
  | { kind: "no_winner" }
  | {
      kind: "winner"
      winnerSponsorId: Id<"sponsors">
      winningBidId: Id<"sponsorshipBidIntents">
      settlementAmountCents: number
    }

export function compareBidIntentChronology(a: IntentDoc, b: IntentDoc): number {
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
  if (a._creationTime !== b._creationTime) {
    return a._creationTime - b._creationTime
  }
  return 0
}

export function compareBidIntentChronologyWithIdTieBreak(
  a: IntentDoc,
  b: IntentDoc
): number {
  const chronology = compareBidIntentChronology(a, b)
  if (chronology !== 0) return chronology
  return String(a._id).localeCompare(String(b._id))
}

export function latestBidIntentBySponsor(
  intents: IntentDoc[],
  compare: (
    a: IntentDoc,
    b: IntentDoc
  ) => number = compareBidIntentChronologyWithIdTieBreak
): Map<Id<"sponsors">, IntentDoc> {
  const latestIntentBySponsor = new Map<Id<"sponsors">, IntentDoc>()
  for (const intent of intents) {
    const latestIntent = latestIntentBySponsor.get(intent.sponsorId)
    if (!latestIntent || compare(intent, latestIntent) > 0) {
      latestIntentBySponsor.set(intent.sponsorId, intent)
    }
  }
  return latestIntentBySponsor
}

export function buildProxyContenders(
  intents: IntentDoc[],
  compare: (
    a: IntentDoc,
    b: IntentDoc
  ) => number = compareBidIntentChronologyWithIdTieBreak
): {
  sponsorId: Id<"sponsors">
  maxAmountCents: number
  firstMaxSetAt: number
  firstMaxSetOrder: number
}[] {
  const contenderBySponsorId = new Map<
    Id<"sponsors">,
    {
      firstMaxSetAt: number
      firstMaxSetOrder: number
      maxAmountCents: number
    }
  >()
  for (const [index, intent] of [...intents].sort(compare).entries()) {
    const maxAmountCents = intent.maxAmountCents ?? intent.amountCents
    const existingContender = contenderBySponsorId.get(intent.sponsorId)
    if (!existingContender) {
      contenderBySponsorId.set(intent.sponsorId, {
        maxAmountCents,
        firstMaxSetAt: intent.createdAt,
        firstMaxSetOrder: index,
      })
      continue
    }
    const maxChanged = existingContender.maxAmountCents !== maxAmountCents
    contenderBySponsorId.set(intent.sponsorId, {
      maxAmountCents,
      firstMaxSetAt: maxChanged
        ? intent.createdAt
        : existingContender.firstMaxSetAt,
      firstMaxSetOrder: maxChanged ? index : existingContender.firstMaxSetOrder,
    })
  }
  return [...contenderBySponsorId.entries()].map(([sponsorId, contender]) => ({
    sponsorId,
    maxAmountCents: contender.maxAmountCents,
    firstMaxSetAt: contender.firstMaxSetAt,
    firstMaxSetOrder: contender.firstMaxSetOrder,
  }))
}

function toSealedBidInputs(validIntents: IntentDoc[]) {
  return validIntents.map((intent) => ({
    intentId: String(intent._id),
    sponsorId: String(intent.sponsorId),
    amountCents: intent.amountCents,
    createdAt: intent.createdAt,
    createdOrder: intent._creationTime,
  }))
}

function resolveSealedLeader(auction: AuctionDoc, validIntents: IntentDoc[]) {
  const sealedState = resolveSealedOutcome(toSealedBidInputs(validIntents), {
    pricing: sealedAuctionPricingRule(auction.framework),
    reservePriceCents: auction.startPriceCents,
  })
  if (!sealedState) return null

  const leaderIntent = validIntents.find(
    (intent) => String(intent._id) === sealedState.leaderIntentId
  )
  if (!leaderIntent) return null

  return { sealedState, leaderIntent }
}

export function resolveAuctionBidState(args: {
  auction: AuctionDoc
  validIntents: IntentDoc[]
}): Pick<
  AuctionDoc,
  "currentLeaderMaxCents" | "currentLeaderSponsorId" | "currentPriceCents"
> {
  if (args.validIntents.length === 0) {
    return { ...emptyBidState }
  }

  if (!isProxyAuctionFramework(args.auction.framework)) {
    const sealed = resolveSealedLeader(args.auction, args.validIntents)
    if (!sealed) return { ...emptyBidState }

    return {
      currentPriceCents: sealed.sealedState.leaderBidCents,
      currentLeaderSponsorId: sealed.leaderIntent.sponsorId,
      currentLeaderMaxCents: sealed.sealedState.leaderBidCents,
    }
  }

  const state = resolveProxyState(
    buildProxyContenders(args.validIntents),
    args.auction.startPriceCents
  )
  if (!state) return { ...emptyBidState }

  return {
    currentPriceCents: state.currentPriceCents,
    currentLeaderSponsorId: state.leaderSponsorId,
    currentLeaderMaxCents: state.leaderMaxCents,
  }
}

export function resolveAuctionOutcome(args: {
  auction: AuctionDoc
  validIntents: IntentDoc[]
}): AuctionOutcome {
  if (args.validIntents.length === 0) {
    return { kind: "no_winner" }
  }

  if (!isProxyAuctionFramework(args.auction.framework)) {
    const sealed = resolveSealedLeader(args.auction, args.validIntents)
    if (!sealed) return { kind: "no_winner" }

    return {
      kind: "winner",
      winnerSponsorId: sealed.leaderIntent.sponsorId,
      winningBidId: sealed.leaderIntent._id,
      settlementAmountCents: sealed.sealedState.settlementBidCents,
    }
  }

  const state = resolveProxyState(
    buildProxyContenders(args.validIntents),
    args.auction.startPriceCents
  )
  if (!state) return { kind: "no_winner" }

  const winnerIntent = latestBidIntentBySponsor(args.validIntents).get(
    state.leaderSponsorId
  )
  if (!winnerIntent) {
    throw new Error("Proxy auction winner is missing its winning bid intent.")
  }
  return {
    kind: "winner",
    winnerSponsorId: state.leaderSponsorId,
    winningBidId: winnerIntent._id,
    settlementAmountCents: state.currentPriceCents,
  }
}
