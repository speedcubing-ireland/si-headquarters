import type { Id } from "@/convex/_generated/dataModel"

export interface SponsorBidOutcomeDisplay {
  sponsorId: Id<"sponsors">
  sponsorName: string
  isWinner: boolean
  isInvited: boolean
  validBidCount: number
  totalBidCount: number
  latestValidBidCents?: number
  latestValidBidAt?: number
  latestValidBidMode?: "proxy" | "manual"
}

export interface InvitedSponsorDisplay {
  sponsorId: Id<"sponsors">
  sponsorName: string
}

export type AdminSponsorshipTab =
  | "open"
  | "closed"
  | "sponsors"
  | "auctionTypes"

export function isAdminSponsorshipTab(
  value: string
): value is AdminSponsorshipTab {
  return (
    value === "open" ||
    value === "closed" ||
    value === "sponsors" ||
    value === "auctionTypes"
  )
}
