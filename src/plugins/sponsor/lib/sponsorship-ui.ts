import { formatDistance, formatDistanceToNow } from "date-fns"
import type { Doc } from "@/convex/_generated/dataModel"
import { sponsorshipConfig } from "@/config/lib/organisation"
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

export function formatCurrencyFromCents(
  cents: number,
  currency = sponsorshipConfig().sponsorship.defaultCurrency
): string {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

export const formatEuroFromCents = formatCurrencyFromCents

export function currencyInputLabel(label: string): string {
  return `${label} (${sponsorshipConfig().sponsorship.defaultCurrency})`
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

export function displayAuctionPriceCents(auction: AuctionPriceFields): number {
  return auction.state === "closed"
    ? (auction.settlementAmountCents ??
        auction.currentPriceCents ??
        auction.startPriceCents)
    : (auction.currentPriceCents ?? auction.startPriceCents)
}

export function formatAuctionTablePrice(auction: AuctionPriceFields): {
  amountCents: number
  showWinningBidLabel: boolean
} {
  const showWinningBidLabel =
    auction.state === "closed" &&
    (isSealedAuctionFramework(auction.framework) ||
      auction.settlementAmountCents !== undefined)

  return { amountCents: displayAuctionPriceCents(auction), showWinningBidLabel }
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

export function auctionScheduleDraftLabels(
  startsAtInput: string,
  endsAtInput: string
): { opensIn: string | null; duration: string | null } {
  const startMs = parseDatetimeLocalInput(startsAtInput)
  const endMs = parseDatetimeLocalInput(endsAtInput)

  const opensIn =
    startMs !== null
      ? `Opens ${formatDistanceToNow(new Date(startMs), { addSuffix: true })}`
      : null

  const duration =
    startMs !== null && endMs !== null && endMs > startMs
      ? formatDistance(new Date(startMs), new Date(endMs))
      : null

  return { opensIn, duration }
}

export function centsToEuroInput(cents: number | undefined): string {
  if (cents === undefined) return ""
  return (cents / 100).toFixed(2)
}
