import type { LucideIcon } from "lucide-react"
import type { ComponentType } from "react"
import { isSponsorshipEnabled } from "@/lib/feature-flags"
import { sponsorPlugin } from "@/plugins/sponsor"

export interface SidebarEntry {
  label: string
  to: string
  icon: LucideIcon
}

export interface Plugin {
  id: string
  nav: SidebarEntry[]
  competitionProperties: ComponentType<{ competitionId: string }>[]
}

export const PLUGINS: Plugin[] = isSponsorshipEnabled ? [sponsorPlugin] : []
