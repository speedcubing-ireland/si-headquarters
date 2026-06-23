/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import type { TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"
import { internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { insertBlankCompetition } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { hashToken } from "@/convex/tokens"

const WCA_USER_ID = 12345

async function seedInvite(t: TestConvex<typeof schema>, token: string) {
  return t.run(async (ctx) => {
    const competitionId = await insertBlankCompetition(ctx)
    const createdByUserId = await ctx.db.insert("users", { name: "Director" })
    await ctx.db.insert("competitionOrganiserInvites", {
      competitionId,
      tokenHash: await hashToken(token),
      createdByUserId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    })
    return competitionId
  })
}

describe("signInWithWca gate", () => {
  test("rejects a new WCA user with no pre-existing record and no invite", async () => {
    const t = convexTest(schema, modules)
    const result = await t.mutation(internal.wcaLogin.internal.signInWithWca, {
      wcaUserId: WCA_USER_ID,
      name: "Alice",
    })
    expect(result).toBeNull()
  })

  test("admits a pre-created WCA user with no invite", async () => {
    const t = convexTest(schema, modules)
    const existingId = await t.run((ctx) =>
      ctx.db.insert("users", { wcaUserId: WCA_USER_ID, name: "Alice" })
    )

    const result = await t.mutation(internal.wcaLogin.internal.signInWithWca, {
      wcaUserId: WCA_USER_ID,
      name: "Alice",
    })
    expect(result).not.toBeNull()
    expect(result?.userId).toBe(existingId)

    const memberships = await t.run((ctx) =>
      ctx.db.query("teamMemberships").collect()
    )
    expect(memberships).toHaveLength(0)
  })

  test("allows an existing WCA user even without an invite", async () => {
    const t = convexTest(schema, modules)
    const existingId = await t.run((ctx) =>
      ctx.db.insert("users", { wcaUserId: WCA_USER_ID, name: "Bob" })
    )

    const result = await t.mutation(internal.wcaLogin.internal.signInWithWca, {
      wcaUserId: WCA_USER_ID,
      name: "Bob Updated",
    })
    expect(result).not.toBeNull()
    expect(result?.userId).toBe(existingId)
  })

  test("invite path: new user with valid invite is created and added to competition organisers", async () => {
    const t = convexTest(schema, modules)
    const inviteToken = "a".repeat(32)
    const competitionId = await seedInvite(t, inviteToken)

    const result = await t.mutation(internal.wcaLogin.internal.signInWithWca, {
      wcaUserId: WCA_USER_ID,
      name: "Carol",
      inviteToken,
    })
    expect(result).not.toBeNull()

    const competition = await t.run((ctx) =>
      ctx.db.get("competitions", competitionId)
    )
    expect(competition?.people.organisers).toContain(result?.userId)
  })

  test("rejects a disabled pre-existing WCA user", async () => {
    const t = convexTest(schema, modules)
    await t.run((ctx) =>
      ctx.db.insert("users", {
        wcaUserId: WCA_USER_ID,
        name: "Disabled",
        disabled: true,
      })
    )

    const result = await t.mutation(internal.wcaLogin.internal.signInWithWca, {
      wcaUserId: WCA_USER_ID,
      name: "Disabled",
    })
    expect(result).toBeNull()
  })
})
