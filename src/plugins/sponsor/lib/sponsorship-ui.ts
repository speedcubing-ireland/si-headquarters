import { formatDistanceToNow } from "date-fns"
import type { Doc } from "@/convex/_generated/dataModel"
import {
  SPONSORSHIP_AUCTION_FRAMEWORKS,
  isSealedAuctionFramework,
  type SponsorshipAuctionFramework,
} from "@/convex/plugins/sponsor/lib/types"
import type { CompetitionSponsorPropertyStatus } from "@/convex/plugins/sponsor/lib/competitionSponsorStatus"
import type { SponsorBidStatus } from "@/convex/plugins/sponsor/lib/sponsorBidStatus"
import type { SponsorshipLifecycle } from "@/convex/plugins/sponsor/lib/sponsorshipLifecycle"

export const SPONSORSHIP_BIDDING_HELP_TITLE = "How this auction works"
export const SPONSOR_GUIDE_PAGE_TITLE = "Sponsor Management System"

export type AuctionPriceFields = Pick<
  Doc<"sponsorshipAuctions">,
  | "framework"
  | "state"
  | "startPriceCents"
  | "currentPriceCents"
  | "settlementAmountCents"
>

export function isSponsorshipFramework(
  value: string
): value is SponsorshipAuctionFramework {
  return SPONSORSHIP_AUCTION_FRAMEWORKS.some((framework) => framework === value)
}

export function sponsorBidStatusLabel(status: SponsorBidStatus): string {
  switch (status) {
    case "winning":
      return "Winning"
    case "not_winning":
      return "Not winning"
    case "winner":
      return "Winner"
    case "not_winner":
      return "Not winner"
    case "bid_submitted":
      return "Bid submitted"
    case "no_bid_submitted":
      return "No bid submitted"
  }
}

export interface ProxyDirectBidCopy {
  title: string
  description: string
  submitLabel: string
  confirmationTitle: string
  confirmationDescription: string
}

const defaultProxyDirectBidCopy: ProxyDirectBidCopy = {
  title: "Place bid",
  description:
    "Enter a visible bid to join the auction. You can also set a secret max bid.",
  submitLabel: "Place bid",
  confirmationTitle: "Place this bid?",
  confirmationDescription:
    "This bid will be visible in the auction activity and may make you the current leader.",
}

export function proxyDirectBidCopy(
  status: SponsorBidStatus | undefined
): ProxyDirectBidCopy {
  switch (status) {
    case "winning":
      return {
        title: "Raise current price",
        description:
          "You are winning. You may optionally raise the visible current price for everyone.",
        submitLabel: "Raise current price",
        confirmationTitle: "Raise the visible price?",
        confirmationDescription:
          "This direct bid will be visible in the auction activity and will raise the current price if accepted.",
      }
    case "not_winning":
      return {
        title: "Counter bid",
        description:
          "Enter a visible bid. Another sponsor's proxy max may respond automatically.",
        submitLabel: "Place counter bid",
        confirmationTitle: "Place this counter bid?",
        confirmationDescription:
          "This bid will be visible in the auction activity. Proxy bids may update the current price immediately.",
      }
    case undefined:
    case "bid_submitted":
    case "no_bid_submitted":
    case "winner":
    case "not_winner":
      return defaultProxyDirectBidCopy
  }
}

export interface ProxyMaxBidCopy {
  title: string
  description: string
  submitLabel: string
  confirmationTitle: string
  confirmationDescription: string
}

export function proxyMaxBidCopy(
  existingMaxBidCents: number | undefined
): ProxyMaxBidCopy {
  const hasExistingMaxBid = existingMaxBidCents !== undefined
  return {
    title: hasExistingMaxBid ? "Increase max bid" : "Set max bid",
    description:
      "Your secret proxy limit stays hidden. The system only bids enough to keep you ahead.",
    submitLabel: hasExistingMaxBid ? "Increase max bid" : "Set max bid",
    confirmationTitle: hasExistingMaxBid
      ? "Increase your secret max?"
      : "Set your secret max?",
    confirmationDescription:
      "Your max bid stays secret. It may update the current price only when proxy rules require it.",
  }
}

export function sponsorshipStateLabel(
  state: Doc<"sponsorshipAuctions">["state"]
): string {
  switch (state) {
    case "draft":
      return "Draft"
    case "scheduled":
      return "Scheduled"
    case "active":
      return "Active"
    case "closed":
      return "Closed"
  }
}

export function sponsorshipStateBadgeVariant(
  state: Doc<"sponsorshipAuctions">["state"]
): "default" | "secondary" | "outline" {
  switch (state) {
    case "active":
      return "default"
    case "scheduled":
      return "secondary"
    case "draft":
    case "closed":
      return "outline"
  }
}

export function sponsorshipLifecycleLabel(
  lifecycle: SponsorshipLifecycle
): string {
  switch (lifecycle) {
    case "upcoming":
      return "Upcoming"
    case "ongoing":
      return "Ongoing"
    case "completed":
      return "Completed"
  }
}

export function sponsorshipLifecycleBadgeVariant(
  lifecycle: SponsorshipLifecycle
): "default" | "secondary" | "outline" {
  switch (lifecycle) {
    case "upcoming":
      return "default"
    case "ongoing":
      return "secondary"
    case "completed":
      return "outline"
  }
}

export function sponsorshipLifecycleStatusText(
  lifecycle: SponsorshipLifecycle,
  startDate: string,
  now = Date.now()
): string {
  if (lifecycle === "ongoing") return "Ongoing"
  if (lifecycle === "completed") return "Completed"
  const startMillis = Date.parse(startDate)
  if (!Number.isFinite(startMillis)) return "Upcoming"
  if (startMillis <= now) return "Starting soon"
  return `Starts ${formatDistanceToNow(new Date(startMillis), { addSuffix: true })}`
}

export function formatEuroFromCents(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`
}

export function competitionPropertyStatusLabel(
  status: CompetitionSponsorPropertyStatus,
  winnerSponsorName?: string
): string {
  if (status === "sponsor" && winnerSponsorName !== undefined) {
    return winnerSponsorName
  }
  switch (status) {
    case "bidding":
      return "Bidding in progress"
    case "sponsor":
      return "Sponsored"
    case "not_offered":
      return "Not Offered"
    case "none":
      return "No Sponsor"
  }
}

function closedPriceCents(auction: AuctionPriceFields): number {
  return (
    auction.settlementAmountCents ??
    auction.currentPriceCents ??
    auction.startPriceCents
  )
}

export function formatAuctionPriceLine(auction: AuctionPriceFields): string {
  if (
    isSealedAuctionFramework(auction.framework) &&
    auction.state !== "closed"
  ) {
    return `Minimum bid: ${formatEuroFromCents(auction.startPriceCents)} · Price sealed until close`
  }

  if (
    isSealedAuctionFramework(auction.framework) &&
    auction.state === "closed"
  ) {
    return `Winning bid: ${formatEuroFromCents(closedPriceCents(auction))}`
  }

  const current = formatEuroFromCents(
    auction.currentPriceCents ?? auction.startPriceCents
  )
  if (
    auction.state === "closed" &&
    auction.settlementAmountCents !== undefined
  ) {
    return `Current: ${current} · Winning bid: ${formatEuroFromCents(auction.settlementAmountCents)}`
  }

  return `Current: ${current}`
}

export function formatAuctionTablePrice(auction: AuctionPriceFields): {
  amountCents: number
  showWinningBidLabel: boolean
} {
  const isClosed = auction.state === "closed"
  const amountCents = isClosed
    ? closedPriceCents(auction)
    : (auction.currentPriceCents ?? auction.startPriceCents)
  const showWinningBidLabel =
    isClosed &&
    (isSealedAuctionFramework(auction.framework) ||
      auction.settlementAmountCents !== undefined)

  return { amountCents, showWinningBidLabel }
}

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase()
}

export function hasSameIdSet<T>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) return false
  const sortedLeft = left.map((id) => String(id)).sort()
  const sortedRight = right.map((id) => String(id)).sort()
  return sortedLeft.every((id, index) => id === sortedRight[index])
}

export function toDatetimeLocalInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function parseDatetimeLocalInput(value: string): number | null {
  const millis = new Date(value).getTime()
  return Number.isFinite(millis) ? millis : null
}

export function centsToEuroInput(cents: number | undefined): string {
  if (cents === undefined) return ""
  return (cents / 100).toFixed(2)
}
