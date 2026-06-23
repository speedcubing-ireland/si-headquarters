"use node"

import {
  isPlainObject,
  readJsonObjectArray,
  readString,
  type JsonRecord,
} from "@/convex/integrations/jsonBoundary"
import { requireConvexEnv } from "@/convex/envTypes"
import type { DiscordLink } from "@/convex/users/validators"

const DISCORD_API = "https://discord.com/api/v10"

function readUserObject(
  member: JsonRecord
): { record: JsonRecord; nick: string | undefined } | null {
  const userValue = member.user
  if (
    typeof userValue !== "object" ||
    userValue === null ||
    Array.isArray(userValue)
  ) {
    return null
  }
  if (!isPlainObject(userValue)) {
    return null
  }
  return { record: userValue, nick: readString(member, "nick") }
}

export function parseDiscordGuildMember(
  member: JsonRecord
): DiscordLink | null {
  const user = readUserObject(member)
  if (user === null) {
    return null
  }

  const discordUserId = readString(user.record, "id")
  const discordUsername = readString(user.record, "username")
  if (discordUserId === undefined || discordUsername === undefined) {
    return null
  }

  const nick = user.nick?.trim()
  const globalName = readString(user.record, "global_name")?.trim()
  const discordDisplayName =
    (nick !== undefined && nick.length > 0 ? nick : undefined) ??
    (globalName !== undefined && globalName.length > 0
      ? globalName
      : undefined) ??
    discordUsername

  return {
    discordUserId,
    discordUsername,
    discordDisplayName,
    discordAvatarHash: readString(user.record, "avatar"),
  }
}

export async function searchGuildMembers(
  query: string,
  limit = 25
): Promise<DiscordLink[]> {
  const guildId = requireConvexEnv(
    "DISCORD_GUILD_ID",
    "Discord member search requires DISCORD_GUILD_ID to be set."
  )
  const botToken = requireConvexEnv(
    "DISCORD_BOT_TOKEN",
    "Discord member search requires DISCORD_BOT_TOKEN to be set."
  )
  const params = new URLSearchParams({
    query,
    limit: String(Math.min(Math.max(limit, 1), 100)),
  })
  const response = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/search?${params.toString()}`,
    { headers: { Authorization: `Bot ${botToken}` } }
  )
  if (!response.ok) {
    throw new Error(
      `Discord member search failed (HTTP ${String(response.status)}).`
    )
  }
  const entries = await readJsonObjectArray(response)
  const members: DiscordLink[] = []
  for (const entry of entries) {
    if (!isPlainObject(entry)) {
      continue
    }
    const parsed = parseDiscordGuildMember(entry)
    if (parsed !== null) {
      members.push(parsed)
    }
  }
  return members
}
