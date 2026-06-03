/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { insertTestUser, seedVolunteerTestUser } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import type { Id } from "@/convex/_generated/dataModel"
import { toPublicUser } from "@/convex/users/queries"

const testUserId = "10000;users" as Id<"users">

describe("toPublicUser", () => {
  test("resolves Discord avatar over auth image when linked", () => {
    const publicUser = toPublicUser({
      _id: testUserId,
      name: "HQ User",
      image: "https://example.com/google.png",
      discordUserId: "123",
      discordAvatarHash: "abc",
    })
    expect(publicUser.image).toBe(
      "https://cdn.discordapp.com/avatars/123/abc.png?size=128"
    )
  })

  test("keeps auth image when Discord is not linked", () => {
    const publicUser = toPublicUser({
      _id: testUserId,
      name: "HQ User",
      image: "https://example.com/google.png",
      discordUserId: undefined,
      discordAvatarHash: undefined,
    })
    expect(publicUser.image).toBe("https://example.com/google.png")
  })
})

describe("users.list public avatars", () => {
  test("returns Discord avatar URL for linked users", async () => {
    const t = convexTest(schema, modules)
    const { volunteerId, linkedUserId } = await t.run(async (ctx) => {
      const volunteerId = await seedVolunteerTestUser(ctx)
      const linkedUserId = await insertTestUser(ctx, "Linked User")
      await ctx.db.patch("users", linkedUserId, {
        image: "https://example.com/google.png",
        discordUserId: "123",
        discordAvatarHash: "abc",
      })
      return { volunteerId, linkedUserId }
    })

    const volunteer = t.withIdentity({ subject: volunteerId })
    const users = await volunteer.query(api.users.queries.list, {})
    const linked = users.find((user) => user._id === linkedUserId)

    expect(linked?.image).toBe(
      "https://cdn.discordapp.com/avatars/123/abc.png?size=128"
    )
  })
})
