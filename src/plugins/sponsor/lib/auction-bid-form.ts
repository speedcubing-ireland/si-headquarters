export type BidAmountParse =
  | { status: "ok"; cents: number }
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "below_minimum"; minimumCents: number }

export function parseBidAmountCents(
  value: string,
  minimumCents: number
): BidAmountParse {
  if (value.length === 0) return { status: "empty" }
  const cents = Math.round(Number(value) * 100)
  if (!Number.isFinite(cents) || cents <= 0) return { status: "invalid" }
  if (cents < minimumCents) return { status: "below_minimum", minimumCents }
  return { status: "ok", cents }
}

export function resolveDisplayedMaxBidEuros(input: {
  override: string | null
  overrideAuctionId: string | null
  currentAuctionId: string | null
  serverMaxBidCents: number | undefined
  isProxyAuction: boolean
}): string {
  if (
    input.override !== null &&
    input.overrideAuctionId === input.currentAuctionId
  ) {
    return input.override
  }
  if (input.isProxyAuction && input.serverMaxBidCents !== undefined) {
    return (input.serverMaxBidCents / 100).toFixed(2)
  }
  return ""
}

export function formatAuctionCountdown(
  targetTime: number,
  now: number
): string {
  const totalSeconds = Math.max(0, Math.ceil((targetTime - now) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":")
}
