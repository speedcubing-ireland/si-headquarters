"use node"

import {
  isPlainObject,
  readJsonObject,
  readJsonObjectArray,
  readNumber,
  readString,
  type JsonRecord,
} from "@/convex/integrations/jsonBoundary"
import { env } from "@/convex/_generated/server"
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
  const response = await fetch(
    `${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}/channels`,
    {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    }
  )
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
    const parsed = parseDiscordChannel(entry, env.DISCORD_GUILD_ID)
    if (parsed !== null) {
      channels.push(parsed)
    }
  }
  return channels
}

export async function lookupDiscordChannel(
  channelId: string
): Promise<DiscordChannelResourceData> {
  const response = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
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
  const channel = parseDiscordChannel(body, env.DISCORD_GUILD_ID)
  if (channel === null) {
    throw new Error("Discord channel not found.")
  }
  return channel
}
