import { oauthPluginTables } from "@/convex/plugins/validators"
import { sponsorTables } from "@/convex/plugins/sponsor/validators"

export const pluginTables = {
  ...oauthPluginTables,
  ...sponsorTables,
}
