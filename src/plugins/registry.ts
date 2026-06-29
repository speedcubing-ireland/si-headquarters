import type { LucideIcon } from "lucide-react"
import type { ComponentType } from "react"
import type { Action, Subject } from "@/features/auth/ability"
import { eventsPlugin } from "@/plugins/events"
import { sponsorPlugin } from "@/plugins/sponsor"
import { socialMediaPlugin } from "@/plugins/social-media"
import { wca2faPlugin } from "@/plugins/wca-2fa"
import { isFeatureEnabled, type FeatureId } from "@/config/lib/organisation"

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
  feature: FeatureId
  nav: SidebarEntry[]
  competitionProperties: ComponentType<{ competitionId: string }>[]
}

const ALL_PLUGINS: Plugin[] = [
  eventsPlugin,
  wca2faPlugin,
  socialMediaPlugin,
  sponsorPlugin,
]

export const PLUGINS: Plugin[] = ALL_PLUGINS.filter((plugin) =>
  isFeatureEnabled(plugin.feature)
)

export function featureForPluginPath(pathname: string): FeatureId | null {
  for (const plugin of ALL_PLUGINS) {
    for (const entry of plugin.nav) {
      if (pathname === entry.to || pathname.startsWith(`${entry.to}/`)) {
        return plugin.feature
      }
    }
  }
  return null
}
