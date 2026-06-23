"use node"

import {
  isPlainObject,
  readJsonObject,
  readJsonObjectArray,
  readNumber,
  readString,
  type JsonRecord,
} from "@/convex/integrations/jsonBoundary"
import { requireConvexEnv } from "@/convex/envTypes"
import type { DiscordChannelResourceData } from "@/convex/integrations/validators"

const DISCORD_API = "https://discord.com/api/v10"

function parseDiscordChannel(
  channel: JsonRecord,
  guildId: string
): DiscordChannelResourceData | null {
  const channelId = readString(channel, "id")
  if (channelId === undefined) {
    return null
  }
  return {
    channelId,
    channelName: readString(channel, "name") ?? channelId,
    guildId,
  }
}

export async function listGuildChannels(): Promise<
  DiscordChannelResourceData[]
> {
  const guildId = requireConvexEnv(
    "DISCORD_GUILD_ID",
    "Discord channel listing requires DISCORD_GUILD_ID to be set."
  )
  const botToken = requireConvexEnv(
    "DISCORD_BOT_TOKEN",
    "Discord channel listing requires DISCORD_BOT_TOKEN to be set."
  )
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${botToken}` },
  })
  if (!response.ok) {
    throw new Error(
      `Discord channel list failed (HTTP ${String(response.status)}).`
    )
  }
  const entries = await readJsonObjectArray(response)
  const channels: DiscordChannelResourceData[] = []
  for (const entry of entries) {
    if (!isPlainObject(entry)) {
      continue
    }
    if (readNumber(entry, "type") !== 0) {
      continue
    }
    const parsed = parseDiscordChannel(entry, guildId)
    if (parsed !== null) {
      channels.push(parsed)
    }
  }
  return channels
}

export async function lookupDiscordChannel(
  channelId: string
): Promise<DiscordChannelResourceData> {
  const guildId = requireConvexEnv(
    "DISCORD_GUILD_ID",
    "Discord channel lookup requires DISCORD_GUILD_ID to be set."
  )
  const botToken = requireConvexEnv(
    "DISCORD_BOT_TOKEN",
    "Discord channel lookup requires DISCORD_BOT_TOKEN to be set."
  )
  const response = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  })
  if (!response.ok) {
    throw new Error(
      `Discord channel lookup failed (HTTP ${String(response.status)}).`
    )
  }
  const body = await readJsonObject(response)
  if (body === null) {
    throw new Error("Discord channel lookup returned an invalid response.")
  }
  const channel = parseDiscordChannel(body, guildId)
  if (channel === null) {
    throw new Error("Discord channel not found.")
  }
  return channel
}
