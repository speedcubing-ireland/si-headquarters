import { describe, expect, test } from "vitest"
import {
  dicebearInitialsUrl,
  resolveDiscordAvatarUrl,
  resolveUserAvatarUrl,
} from "@/convex/users/avatar"

describe("resolveUserAvatarUrl", () => {
  test("prefers Discord avatar when linked", () => {
    const url = resolveUserAvatarUrl({
      name: "HQ User",
      image: "https://example.com/google.png",
      discordUserId: "123",
      discordAvatarHash: "abc",
    })
    expect(url).toBe("https://cdn.discordapp.com/avatars/123/abc.png?size=128")
  })

  test("falls back to dicebear when only a name is available", () => {
    const url = resolveUserAvatarUrl({
      name: "HQ User",
      image: undefined,
      discordUserId: undefined,
      discordAvatarHash: undefined,
    })
    expect(url).toBe(dicebearInitialsUrl("HQ User"))
  })

  test("falls back to Google image when Discord is not linked", () => {
    const url = resolveUserAvatarUrl({
      name: "HQ User",
      image: "https://example.com/google.png",
      discordUserId: undefined,
      discordAvatarHash: undefined,
    })
    expect(url).toBe("https://example.com/google.png")
  })
})

describe("resolveDiscordAvatarUrl", () => {
  test("uses default avatar when hash is missing", () => {
    const url = resolveDiscordAvatarUrl("143123456789012345", undefined)
    expect(url).toMatch(
      /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/\d\.png$/
    )
  })

  test("uses gif extension for animated avatars", () => {
    const url = resolveDiscordAvatarUrl("123", "a_animatedhash")
    expect(url).toBe(
      "https://cdn.discordapp.com/avatars/123/a_animatedhash.gif?size=128"
    )
  })
})
