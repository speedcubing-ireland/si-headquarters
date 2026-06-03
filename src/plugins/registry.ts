import type { LucideIcon } from "lucide-react"
import type { ComponentType } from "react"
import type { Action, Subject } from "@/features/auth/ability"
import { isSponsorshipEnabled } from "@/lib/feature-flags"
import { sponsorPlugin } from "@/plugins/sponsor"
import { socialMediaPlugin } from "@/plugins/social-media"
import { wca2faPlugin } from "@/plugins/wca-2fa"

export interface SidebarEntry {
  label: string
  to: string
  icon: LucideIcon
  ability?: {
    action: Action
    subject: Subject
  }
}

export interface Plugin {
  id: string
  nav: SidebarEntry[]
  competitionProperties: ComponentType<{ competitionId: string }>[]
}

export const PLUGINS: Plugin[] = [
  wca2faPlugin,
  socialMediaPlugin,
  ...(isSponsorshipEnabled ? [sponsorPlugin] : []),
]
