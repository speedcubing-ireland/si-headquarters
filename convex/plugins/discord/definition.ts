import type { BackendIntegrationPlugin } from "@/convex/plugins/integrationTypes"

export const discordPlugin: BackendIntegrationPlugin = {
  id: "discord",
  env: ["DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID"],
}
