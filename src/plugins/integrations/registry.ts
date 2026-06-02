import type { Id } from "@/convex/_generated/dataModel"
import type {
  CompetitionResourceData,
  CompetitionResourceType,
  PluginId,
  TaskIntegrationId,
} from "@/convex/plugins/core/types"
import type { TaskIntegrationCardRow } from "@/features/integrations/task-integration-card-shell"
import { canvaIntegrationPlugin } from "@/plugins/canva"
import { discordIntegrationPlugin } from "@/plugins/discord"
import { sheetsIntegrationPlugin } from "@/plugins/sheets"
import { wcaIntegrationPlugin } from "@/plugins/wca"
import type { LucideIcon } from "lucide-react"
import type { ComponentType, ReactNode } from "react"

export interface LinkResourceActionProps {
  competitionId: Id<"competitions">
}

export interface TaskIntegrationCardProps {
  row: TaskIntegrationCardRow
}

export interface IntegrationPlugin {
  id: PluginId
  competitionLink?: CompetitionResourceType
  matchesResourceType: (
    type: CompetitionResourceData["resourceType"]
  ) => boolean
  resourceIcon: (data: CompetitionResourceData) => ReactNode
  resourceLabel: (data: CompetitionResourceData) => string
  resourceHref: (data: CompetitionResourceData) => string | undefined
  LinkResourceAction?: ComponentType<LinkResourceActionProps>
  adminIcon?: LucideIcon
  taskIntegrationIds?: readonly TaskIntegrationId[]
  DefaultTaskIntegrationCard?: ComponentType<TaskIntegrationCardProps>
  taskIntegrationCards?: Partial<
    Record<TaskIntegrationId, ComponentType<TaskIntegrationCardProps>>
  >
}

export const INTEGRATION_PLUGINS: IntegrationPlugin[] = [
  sheetsIntegrationPlugin,
  wcaIntegrationPlugin,
  canvaIntegrationPlugin,
  discordIntegrationPlugin,
]

const competitionLinkPlugins = INTEGRATION_PLUGINS.filter(
  (
    plugin
  ): plugin is IntegrationPlugin & {
    competitionLink: CompetitionResourceType
  } => plugin.competitionLink !== undefined
)

export const COMPETITION_LINK_PLUGINS = [...competitionLinkPlugins].sort(
  (a, b) => b.id.localeCompare(a.id)
)

const taskIntegrationCardEntries = INTEGRATION_PLUGINS.flatMap((plugin) =>
  (plugin.taskIntegrationIds ?? []).flatMap((id) => {
    const Card =
      plugin.taskIntegrationCards?.[id] ?? plugin.DefaultTaskIntegrationCard
    return Card === undefined ? [] : [[id, Card] as const]
  })
)

export const TASK_INTEGRATION_CARDS = new Map(taskIntegrationCardEntries)
