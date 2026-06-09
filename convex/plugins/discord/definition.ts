import type { EnvServiceManifest } from "@/convex/envConfig"

export const DISCORD_DEFINITION = {
  env: [
    "DISCORD_BOT_TOKEN",
    "DISCORD_GUILD_ID",
    "DISCORD_ACTION_SECRET",
    "DISCORD_PUBLIC_KEY",
  ],
  setup: [
    {
      key: "DISCORD_BOT_TOKEN",
      group: "Discord",
      kind: "prompt",
      description: "Discord bot token.",
      sensitive: true,
    },
    {
      key: "DISCORD_GUILD_ID",
      group: "Discord",
      kind: "prompt",
      description: "Discord server ID.",
    },
    {
      key: "DISCORD_ACTION_SECRET",
      group: "Discord",
      kind: "generated",
      description: "Shared secret for Discord action custom IDs.",
      sensitive: true,
    },
    {
      key: "DISCORD_PUBLIC_KEY",
      group: "Discord",
      kind: "prompt",
      description: "Discord application public key.",
    },
  ],
} as const satisfies EnvServiceManifest

export const DISCORD_ENV_KEYS = DISCORD_DEFINITION.env

export const discordPlugin = {
  id: "discord",
  env: DISCORD_ENV_KEYS,
} as const
