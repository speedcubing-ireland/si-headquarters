import {
  sponsorBidStatusLabel,
  type SponsorBidStatus,
} from "@/plugins/sponsor/lib/sponsorship-ui"
import { Check, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type SponsorBidStatusBadgeSize = "compact" | "default"

export function SponsorBidStatusBadge(props: {
  status: SponsorBidStatus | undefined
  size?: SponsorBidStatusBadgeSize
  showDot?: boolean
}) {
  const { status, size = "default", showDot = false } = props
  if (!status) return null

  const isPositive = status === "winning" || status === "winner"
  const isInfo = status === "bid_submitted"
  const isCheck = isPositive || isInfo

  const variant = isInfo ? "secondary" : isPositive ? "default" : "destructive"

  const IndicatorIcon = isCheck ? Check : X

  return (
    <Badge
      variant={variant}
      className={cn(size === "compact" && "text-[11px]")}
    >
      {showDot ? <IndicatorIcon className="size-3" /> : null}
      {sponsorBidStatusLabel(status)}
    </Badge>
  )
}
