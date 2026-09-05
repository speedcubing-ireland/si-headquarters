import {
  integrationPluginTables,
  oauthPluginTables,
  projectWorkflowTables,
} from "@/convex/plugins/validators"
import type { BackendProjectWorkflowPlugin } from "@/convex/projectWorkflows/types"
import type { BackendIntegrationPlugin } from "@/convex/integrations/taskIntegrations/pluginContract"
import type { CompetitionDeletionPlugin } from "@/convex/competitions/deletionPlugin"
import { certificatesPlugin } from "@/convex/plugins/certificates/plugin"
import { eventsTables } from "@/convex/plugins/events/validators"
import { refundsTables } from "@/convex/plugins/refunds/validators"
import { sponsorTables } from "@/convex/plugins/sponsor/validators"
import { canvaPlugin } from "@/convex/plugins/canva/backendPlugin"
import { discordPlugin } from "@/convex/plugins/discord/definition"
import { sheetsPlugin } from "@/convex/plugins/sheets/definition"
import { wcaPlugin } from "@/convex/plugins/wca/definition"
import { wcaTables } from "@/convex/plugins/wca/validators"
import { isFeatureEnabled } from "@/config/lib/organisation"
import { sponsorCompetitionDeletionPlugin } from "@/convex/plugins/sponsor/admin/auctions/deletion"

type BackendPlugin = BackendIntegrationPlugin & BackendProjectWorkflowPlugin

export const INTEGRATION_PLUGINS = [
  // Sheets integrations (schedule transfer + check-in) need both a Google sheet
  // and a WCA competition, so the plugin is only useful when both are enabled.
  ...(isFeatureEnabled("google") && isFeatureEnabled("wcaIntegration")
    ? [sheetsPlugin]
    : []),
  ...(isFeatureEnabled("wcaIntegration") ? [wcaPlugin] : []),
  ...(isFeatureEnabled("canva") ? [canvaPlugin] : []),
  ...(isFeatureEnabled("discord") ? [discordPlugin] : []),
] as const satisfies readonly BackendIntegrationPlugin[]

export const BACKEND_PLUGINS: readonly BackendPlugin[] = [
  ...INTEGRATION_PLUGINS,
  certificatesPlugin,
]

export const COMPETITION_DELETION_PLUGINS = [
  ...(isFeatureEnabled("sponsors") ? [sponsorCompetitionDeletionPlugin] : []),
] as const satisfies readonly CompetitionDeletionPlugin[]

export const pluginTables = {
  ...oauthPluginTables,
  ...integrationPluginTables,
  ...projectWorkflowTables,
  ...eventsTables,
  ...refundsTables,
  ...sponsorTables,
  ...wcaTables,
}
