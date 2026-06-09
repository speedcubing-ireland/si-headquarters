import {
  integrationPluginTables,
  oauthPluginTables,
} from "@/convex/plugins/validators"
import type { BackendIntegrationPlugin } from "@/convex/plugins/core/integrationTypes"
import { sponsorTables } from "@/convex/plugins/sponsor/validators"
import { canvaPlugin } from "@/convex/plugins/canva/backendPlugin"
import { discordPlugin } from "@/convex/plugins/discord/definition"
import { sheetsPlugin } from "@/convex/plugins/sheets/definition"
import { wcaPlugin } from "@/convex/plugins/wca/definition"

export const INTEGRATION_PLUGINS = [
  sheetsPlugin,
  wcaPlugin,
  canvaPlugin,
  discordPlugin,
] as const satisfies readonly BackendIntegrationPlugin[]

export const pluginTables = {
  ...oauthPluginTables,
  ...integrationPluginTables,
  ...sponsorTables,
}
