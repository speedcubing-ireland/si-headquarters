import { describe, expect, test } from "vitest"
import { parseDiscordGuildMember } from "@/convex/plugins/discord/members"

describe("parseDiscordGuildMember", () => {
  test("uses global_name when nick is absent", () => {
    const parsed = parseDiscordGuildMember({
      nick: null,
      user: {
        id: "123",
        username: "cube_fan",
        global_name: "Cube Fan",
        avatar: "abc123",
      },
    })
    expect(parsed).toEqual({
      discordUserId: "123",
      discordUsername: "cube_fan",
      discordDisplayName: "Cube Fan",
      discordAvatarHash: "abc123",
    })
  })

  test("prefers nick over global_name and username", () => {
    const parsed = parseDiscordGuildMember({
      nick: "Event Lead",
      user: {
        id: "456",
        username: "lead",
        global_name: "Global Name",
      },
    })
    expect(parsed?.discordDisplayName).toBe("Event Lead")
  })

  test("falls back to username when display names are missing", () => {
    const parsed = parseDiscordGuildMember({
      user: {
        id: "789",
        username: "only_username",
      },
    })
    expect(parsed?.discordDisplayName).toBe("only_username")
  })

  test("handles missing avatar", () => {
    const parsed = parseDiscordGuildMember({
      user: {
        id: "999",
        username: "no_avatar",
        avatar: null,
      },
    })
    expect(parsed?.discordAvatarHash).toBeUndefined()
  })

  test("returns null for malformed entries", () => {
    expect(parseDiscordGuildMember({})).toBeNull()
    expect(parseDiscordGuildMember({ user: "not-an-object" })).toBeNull()
    expect(
      parseDiscordGuildMember({ user: { username: "missing-id" } })
    ).toBeNull()
  })
})
