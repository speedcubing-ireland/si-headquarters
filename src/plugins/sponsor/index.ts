import { GavelIcon } from "lucide-react"
import type { Plugin } from "@/plugins/registry"
import {
  SponsorPropertyRow,
  WinningBidPropertyRow,
} from "@/plugins/sponsor/property/competition-sponsor-properties"

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
