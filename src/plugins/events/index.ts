import { CalendarDaysIcon } from "lucide-react"
import type { Plugin } from "@/plugins/registry"

export const eventsPlugin: Plugin = {
  id: "events",
  feature: "events",
  nav: [
    {
      label: "Events",
      to: "/events",
      icon: CalendarDaysIcon,
      ability: {
        action: "access",
        subject: "EventsDashboard",
      },
    },
  ],
  competitionProperties: [],
}
