import { ReceiptIcon } from "lucide-react"
import type { Plugin } from "@/plugins/registry"

export const refundsPlugin: Plugin = {
  id: "refunds",
  feature: "refunds",
  nav: [
    {
      label: "Refunds",
      to: "/admin/refunds",
      icon: ReceiptIcon,
      ability: {
        action: "access",
        subject: "RefundsDashboard",
      },
    },
  ],
  competitionProperties: [],
}
