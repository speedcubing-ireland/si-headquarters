import { MegaphoneIcon } from "lucide-react"
import type { Plugin } from "@/plugins/registry"

export const socialMediaPlugin: Plugin = {
  id: "social-media",
  nav: [
    {
      label: "Social Media",
      to: "/plugins/social-media",
      icon: MegaphoneIcon,
      ability: {
        action: "access",
        subject: "SocialMediaDashboard",
      },
    },
  ],
  competitionProperties: [],
}
