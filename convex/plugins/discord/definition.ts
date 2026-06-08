import type { BackendIntegrationPlugin } from "@/convex/plugins/core/integrationTypes"

export const discordPlugin = {
  id: "discord",
  env: [
    "DISCORD_BOT_TOKEN",
    "DISCORD_GUILD_ID",
    "DISCORD_ACTION_SECRET",
    "DISCORD_PUBLIC_KEY",
  ],
} satisfies BackendIntegrationPlugin
