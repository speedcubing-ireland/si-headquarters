"use node"

import {
  isPlainObject,
  readJsonObject,
  readJsonObjectArray,
  readNumber,
  readString,
  type JsonRecord,
} from "@/convex/plugins/core/jsonBoundary"

const DISCORD_API = "https://discord.com/api/v10"

function requireBotToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN
  if (token === undefined || token === "") {
    throw new Error("DISCORD_BOT_TOKEN is not set in Convex env.")
  }
  return token
}

function requireGuildId(): string {
  const guildId = process.env.DISCORD_GUILD_ID
  if (guildId === undefined || guildId === "") {
    throw new Error("DISCORD_GUILD_ID is not set in Convex env.")
  }
  return guildId
}

export interface DiscordChannelSummary {
  channelId: string
  channelName: string
  guildId: string
}

function parseDiscordChannel(
  channel: JsonRecord,
  guildId: string
): DiscordChannelSummary | null {
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

export async function listGuildChannels(): Promise<DiscordChannelSummary[]> {
  const token = requireBotToken()
  const guildId = requireGuildId()
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Discord channel list failed (HTTP ${String(response.status)}).`)
  }
  const entries = await readJsonObjectArray(response)
  const channels: DiscordChannelSummary[] = []
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
): Promise<DiscordChannelSummary> {
  const token = requireBotToken()
  const guildId = requireGuildId()
  const response = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    headers: { Authorization: `Bot ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Discord channel lookup failed (HTTP ${String(response.status)}).`)
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
