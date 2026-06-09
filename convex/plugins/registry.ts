import {
  integrationPluginTables,
  oauthPluginTables,
  projectWorkflowTables,
} from "@/convex/plugins/validators"
import type { BackendProjectWorkflowPlugin } from "@/convex/projectWorkflows/types"
import type { BackendIntegrationPlugin } from "@/convex/integrations/taskIntegrations/pluginContract"
import { certificatesPlugin } from "@/convex/plugins/certificates/plugin"
import { sponsorTables } from "@/convex/plugins/sponsor/validators"
import { canvaPlugin } from "@/convex/plugins/canva/backendPlugin"
import { discordPlugin } from "@/convex/plugins/discord/definition"
import { sheetsPlugin } from "@/convex/plugins/sheets/definition"
import { wcaPlugin } from "@/convex/plugins/wca/definition"

type BackendPlugin = BackendIntegrationPlugin & BackendProjectWorkflowPlugin

export const INTEGRATION_PLUGINS = [
  sheetsPlugin,
  wcaPlugin,
  canvaPlugin,
  discordPlugin,
] as const satisfies readonly BackendIntegrationPlugin[]

export const BACKEND_PLUGINS: readonly BackendPlugin[] = [
  ...INTEGRATION_PLUGINS,
  certificatesPlugin,
]

export const pluginTables = {
  ...oauthPluginTables,
  ...integrationPluginTables,
  ...projectWorkflowTables,
  ...sponsorTables,
}
