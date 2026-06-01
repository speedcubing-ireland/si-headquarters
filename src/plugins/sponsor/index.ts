import { GavelIcon } from "lucide-react"
import type { Plugin } from "@/plugins/registry"
import { SponsorPropertyRow } from "@/plugins/sponsor/property/sponsor-property-row"
import { WinningBidPropertyRow } from "@/plugins/sponsor/property/winning-bid-row"

export const sponsorPlugin: Plugin = {
  id: "sponsor",
  nav: [
    {
      label: "Sponsorship",
      to: "/admin/sponsorship",
      icon: GavelIcon,
      ability: {
        action: "access",
        subject: "SponsorPortalAdmin",
      },
    },
  ],
  competitionProperties: [SponsorPropertyRow, WinningBidPropertyRow],
}
