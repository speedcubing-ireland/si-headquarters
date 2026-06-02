import {
  integrationPluginTables,
  oauthPluginTables,
} from "@/convex/plugins/validators"
import type { BackendIntegrationPlugin } from "@/convex/plugins/core/integrationTypes"
import { sponsorTables } from "@/convex/plugins/sponsor/validators"
import { canvaPlugin } from "@/convex/plugins/canva/definition"
import { discordPlugin } from "@/convex/plugins/discord/definition"
import { sheetsPlugin } from "@/convex/plugins/sheets/definition"
import { wcaPlugin } from "@/convex/plugins/wca/definition"

export const INTEGRATION_PLUGINS: readonly BackendIntegrationPlugin[] = [
  sheetsPlugin,
  wcaPlugin,
  canvaPlugin,
  discordPlugin,
]

export const pluginTables = {
  ...oauthPluginTables,
  ...integrationPluginTables,
  ...sponsorTables,
}
