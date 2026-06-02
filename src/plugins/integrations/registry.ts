import type { Doc, Id } from "@/convex/_generated/dataModel"
import type {
  CompetitionResourceData,
  CompetitionResourceType,
  TaskIntegrationId,
} from "@/convex/plugins/core/types"
import { canvaIntegrationPlugin } from "@/plugins/canva"
import { discordIntegrationPlugin } from "@/plugins/discord"
import { sheetsIntegrationPlugin } from "@/plugins/sheets"
import { wcaIntegrationPlugin } from "@/plugins/wca"
import type { LucideIcon } from "lucide-react"
import type { ComponentType, ReactNode } from "react"

export interface LinkResourceActionProps {
  competitionId: Id<"competitions">
}

export interface IntegrationPlugin {
  id: string
  competitionLink?: CompetitionResourceType
  matchesResourceType: (
    type: CompetitionResourceData["resourceType"]
  ) => boolean
  resourceIcon: (data: CompetitionResourceData) => ReactNode
  resourceLabel: (data: CompetitionResourceData) => string
  resourceHref: (data: CompetitionResourceData) => string | undefined
  LinkResourceAction?: ComponentType<LinkResourceActionProps>
  taskIntegrationIds: readonly TaskIntegrationId[]
  taskIntegrationCards: Partial<
    Record<
      TaskIntegrationId,
      ComponentType<{
        row: Doc<"taskIntegrations">
        taskId: Id<"tasks">
      }>
    >
  >
  adminIcon?: LucideIcon
}

export const INTEGRATION_PLUGINS: IntegrationPlugin[] = [
  sheetsIntegrationPlugin,
  wcaIntegrationPlugin,
  canvaIntegrationPlugin,
  discordIntegrationPlugin,
]

const competitionLinkPlugins = INTEGRATION_PLUGINS.filter(
  (plugin): plugin is IntegrationPlugin & {
    competitionLink: CompetitionResourceType
  } => plugin.competitionLink !== undefined
)

export const COMPETITION_LINK_PLUGINS = [...competitionLinkPlugins].sort(
  (a, b) => b.id.localeCompare(a.id)
)
