import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  SponsorFrameworkGuideCard,
  SponsorFrameworkGuideGrid,
} from "@/plugins/sponsor/components/sponsor-framework-guide-card"
import {
  SPONSORSHIP_BIDDING_HELP_TITLE,
  sponsorshipFrameworkLabel,
  type SponsorshipFramework,
} from "@/plugins/sponsor/lib/sponsorship-ui"

export function AuctionBiddingHelpOverview() {
  return <SponsorFrameworkGuideGrid />
}

export function AuctionBiddingHelpDialog({
  framework,
  open,
  onOpenChange,
  title = SPONSORSHIP_BIDDING_HELP_TITLE,
}: {
  framework: SponsorshipFramework
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {sponsorshipFrameworkLabel(framework)} rules for this auction.
          </DialogDescription>
        </DialogHeader>
        <SponsorFrameworkGuideCard framework={framework} embedded />
      </DialogContent>
    </Dialog>
  )
}
