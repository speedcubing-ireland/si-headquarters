import type { PluginId } from "@/convex/integrations/constants"
import type {
  LinkedResourceData,
  LinkedResourceType,
} from "@/convex/integrations/validators"
import type { CompetitionOrProjectRef } from "@/convex/utils"
import type { TaskIntegrationId } from "@/convex/integrations/taskIntegrations/validators"
import type { Id as ConvexId } from "@/convex/_generated/dataModel"
import type { TaskIntegrationCardRow } from "@/features/integrations/task-integration-card-shell"
import { canvaIntegrationPlugin } from "@/plugins/canva"
import { discordIntegrationPlugin } from "@/plugins/discord"
import { sheetsIntegrationPlugin } from "@/plugins/sheets"
import { wcaIntegrationPlugin } from "@/plugins/wca"
import type { LucideIcon } from "lucide-react"
import type { ComponentType, ReactNode } from "react"
import { isFeatureEnabled } from "@/config/lib/organisation"

export interface LinkResourceActionProps {
  object: CompetitionOrProjectRef
}

export interface TaskIntegrationCardProps {
  row: TaskIntegrationCardRow
}

export interface TeamLinkedResourceActionProps {
  teamId: ConvexId<"teams">
  linkedChannelName: string | null
}

export interface IntegrationPlugin {
  id: PluginId
  linkedResource?: {
    resourceType: LinkedResourceType
    objectTypes: readonly CompetitionOrProjectRef["type"][]
  }
  matchesResourceType: (type: LinkedResourceData["resourceType"]) => boolean
  resourceIcon: (data: LinkedResourceData) => ReactNode
  resourceLabel: (data: LinkedResourceData) => string
  resourceHref: (data: LinkedResourceData) => string | undefined
  LinkResourceAction?: ComponentType<LinkResourceActionProps>
  TeamLinkedResourceAction?: ComponentType<TeamLinkedResourceActionProps>
  adminIcon?: LucideIcon
  taskIntegrationIds?: readonly TaskIntegrationId[]
  DefaultTaskIntegrationCard?: ComponentType<TaskIntegrationCardProps>
  taskIntegrationCards?: Partial<
    Record<TaskIntegrationId, ComponentType<TaskIntegrationCardProps>>
  >
}

export const INTEGRATION_PLUGINS: IntegrationPlugin[] = [
  // Sheets integrations (schedule transfer + check-in) and the linked Google
  // sheet resource are only useful when both Google and WCA are enabled.
  ...(isFeatureEnabled("google") && isFeatureEnabled("wcaIntegration")
    ? [sheetsIntegrationPlugin]
    : []),
  ...(isFeatureEnabled("wcaIntegration") ? [wcaIntegrationPlugin] : []),
  ...(isFeatureEnabled("canva") ? [canvaIntegrationPlugin] : []),
  ...(isFeatureEnabled("discord") ? [discordIntegrationPlugin] : []),
]

export function getLinkedResourcePlugins(
  objectType: CompetitionOrProjectRef["type"]
) {
  return INTEGRATION_PLUGINS.filter(
    (
      plugin
    ): plugin is IntegrationPlugin & {
      linkedResource: NonNullable<IntegrationPlugin["linkedResource"]>
    } => plugin.linkedResource?.objectTypes.includes(objectType) === true
  ).sort((a, b) => b.id.localeCompare(a.id))
}

const taskIntegrationCardEntries = INTEGRATION_PLUGINS.flatMap((plugin) =>
  (plugin.taskIntegrationIds ?? []).flatMap((id) => {
    const Card =
      plugin.taskIntegrationCards?.[id] ?? plugin.DefaultTaskIntegrationCard
    return Card === undefined ? [] : [[id, Card] as const]
  })
)

export const TASK_INTEGRATION_CARDS = new Map(taskIntegrationCardEntries)

export function getTeamLinkedResourceAction(pluginId: PluginId) {
  return INTEGRATION_PLUGINS.find((plugin) => plugin.id === pluginId)
    ?.TeamLinkedResourceAction
}
