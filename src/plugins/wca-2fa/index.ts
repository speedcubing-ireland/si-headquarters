import { ShieldCheckIcon } from "lucide-react"
import type { Plugin } from "@/plugins/registry"

export const wca2faPlugin: Plugin = {
  id: "wca-2fa",
  feature: "wcaIntegration",
  nav: [
    {
      label: "WCA 2FA",
      to: "/plugins/wca-2fa",
      icon: ShieldCheckIcon,
      ability: {
        action: "access",
        subject: "Wca2fa",
      },
    },
  ],
  competitionProperties: [],
}
