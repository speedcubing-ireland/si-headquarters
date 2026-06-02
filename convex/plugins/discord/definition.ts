import type { BackendIntegrationPlugin } from "@/convex/plugins/core/integrationTypes"

export const discordPlugin = {
  id: "discord",
  env: ["DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID"],
} satisfies BackendIntegrationPlugin
