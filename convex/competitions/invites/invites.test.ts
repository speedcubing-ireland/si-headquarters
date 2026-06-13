import { api, internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { ORGANISER_INVITE_TTL_MS } from "@/convex/competitions/invites/validators"
import schema from "@/convex/schema"
import {
  insertBlankCompetition,
  insertTestUser,
  withVolunteerTestClient,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"

function expectSignedIn(result: { userId: Id<"users"> } | null): Id<"users"> {
  if (result === null) {
    throw new Error("expected WCA sign-in to succeed")
  }
  return result.userId
}

function tokenFromInviteUrl(url: string): string {
  const token = new URL(url).searchParams.get("token")
  if (token === null) {
    throw new Error("invite URL is missing a token")
  }
  return token
}

async function setupInvite() {
  const t = convexTest(schema, modules)
  const { client } = await withVolunteerTestClient(t)
  const competitionId = await t.run(async (ctx) => insertBlankCompetition(ctx))
  const link = await client.mutation(
    api.competitions.invites.mutations.create,
    {
      id: competitionId,
    }
  )
  return { t, client, competitionId, link, token: tokenFromInviteUrl(link.url) }
}

describe("organiser invites", () => {
  test("managers can create, list, and revoke invite links", async () => {
    const { client, competitionId, link } = await setupInvite()

    expect(link.url).toContain("/invite/organiser?token=")
    expect(link.expiresAt).toBeGreaterThan(Date.now())
    expect(link.expiresAt).toBeLessThanOrEqual(
      Date.now() + ORGANISER_INVITE_TTL_MS
    )

    const invites = await client.query(api.competitions.invites.queries.list, {
      id: competitionId,
    })
    expect(invites).toHaveLength(1)

    await client.mutation(api.competitions.invites.mutations.revoke, {
      id: competitionId,
      inviteId: invites[0]._id,
    })
    await expect(
      client.query(api.competitions.invites.queries.list, {
        id: competitionId,
      })
    ).resolves.toEqual([])
  })

  test("organisers cannot create invite links", async () => {
    const t = convexTest(schema, modules)
    const { organiserId, competitionId } = await t.run(async (ctx) => {
      const organiserId = await insertTestUser(ctx, "Organiser")
      const competitionId = await insertBlankCompetition(ctx)
      const competition = await ctx.db.get("competitions", competitionId)
      if (competition === null) throw new Error("missing competition")
      await ctx.db.patch("competitions", competitionId, {
        people: { ...competition.people, organisers: [organiserId] },
      })
      return { organiserId, competitionId }
    })

    await expect(
      t
        .withIdentity({ subject: organiserId })
        .mutation(api.competitions.invites.mutations.create, {
          id: competitionId,
        })
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
  })

  test("invite context is public and rejects bad tokens", async () => {
    const { t, token } = await setupInvite()

    const context = await t.query(api.organisers.queries.inviteContext, {
      token,
    })
    // WCA login env is unset in tests, so a valid invite still yields null
    // (no authorize URL); a bogus token must also yield null.
    expect(context).toBeNull()
    await expect(
      t.query(api.organisers.queries.inviteContext, { token: "short" })
    ).resolves.toBeNull()
  })
})

describe("WCA sign-in gate", () => {
  async function signInWithWca(
    t: TestConvex<typeof schema>,
    args: { wcaUserId: number; inviteToken?: string; name?: string }
  ) {
    return await t.mutation(internal.organisers.internal.signInWithWca, args)
  }

  test("a valid invite creates the user and adds them as organiser", async () => {
    const { t, competitionId, token } = await setupInvite()

    const result = await signInWithWca(t, {
      wcaUserId: 2024,
      name: "WCA Organiser",
      inviteToken: token,
    })
    const userId = expectSignedIn(result)

    await t.run(async (ctx) => {
      const user = await ctx.db.get("users", userId)
      expect(user?.wcaUserId).toBe(2024)
      expect(user?.name).toBe("WCA Organiser")
      const competition = await ctx.db.get("competitions", competitionId)
      expect(competition?.people.organisers).toEqual([userId])
    })
  })

  test("invite links are reusable and do not duplicate organisers", async () => {
    const { t, competitionId, token } = await setupInvite()

    const first = await signInWithWca(t, { wcaUserId: 1, inviteToken: token })
    const second = await signInWithWca(t, { wcaUserId: 2, inviteToken: token })
    const firstAgain = await signInWithWca(t, {
      wcaUserId: 1,
      inviteToken: token,
    })

    expect(firstAgain?.userId).toEqual(first?.userId)
    await t.run(async (ctx) => {
      const competition = await ctx.db.get("competitions", competitionId)
      expect(competition?.people.organisers).toEqual([
        first?.userId,
        second?.userId,
      ])
    })
  })

  test("sign-in fails without an invite for unknown WCA users", async () => {
    const t = convexTest(schema, modules)
    await expect(signInWithWca(t, { wcaUserId: 99 })).resolves.toBeNull()
  })

  test("expired and revoked invites do not admit new users", async () => {
    const { t, client, competitionId, token } = await setupInvite()

    await t.run(async (ctx) => {
      const invite = await ctx.db
        .query("competitionOrganiserInvites")
        .withIndex("by_competitionId", (q) =>
          q.eq("competitionId", competitionId)
        )
        .unique()
      if (invite === null) throw new Error("missing invite")
      await ctx.db.patch("competitionOrganiserInvites", invite._id, {
        expiresAt: Date.now() - 1,
      })
    })
    await expect(
      signInWithWca(t, { wcaUserId: 7, inviteToken: token })
    ).resolves.toBeNull()

    const fresh = await client.mutation(
      api.competitions.invites.mutations.create,
      { id: competitionId }
    )
    const freshToken = tokenFromInviteUrl(fresh.url)
    const invites = await client.query(api.competitions.invites.queries.list, {
      id: competitionId,
    })
    await client.mutation(api.competitions.invites.mutations.revoke, {
      id: competitionId,
      inviteId: invites[0]._id,
    })
    await expect(
      signInWithWca(t, { wcaUserId: 7, inviteToken: freshToken })
    ).resolves.toBeNull()
  })

  test("existing WCA users can sign in again without an invite", async () => {
    const { t, token } = await setupInvite()
    const created = await signInWithWca(t, {
      wcaUserId: 55,
      inviteToken: token,
    })

    const again = await signInWithWca(t, { wcaUserId: 55 })
    expect(again?.userId).toEqual(created?.userId)
  })

  test("an expired invite does not block existing WCA users", async () => {
    const { t, token } = await setupInvite()
    const created = await signInWithWca(t, {
      wcaUserId: 55,
      inviteToken: token,
    })

    const again = await signInWithWca(t, {
      wcaUserId: 55,
      inviteToken: "0".repeat(64),
    })
    expect(again?.userId).toEqual(created?.userId)
  })

  test("disabled users cannot sign in with WCA", async () => {
    const { t, token } = await setupInvite()
    const created = await signInWithWca(t, {
      wcaUserId: 55,
      inviteToken: token,
    })
    const createdUserId = expectSignedIn(created)
    await t.run(async (ctx) => {
      await ctx.db.patch("users", createdUserId, {
        disabled: true,
      })
    })

    await expect(signInWithWca(t, { wcaUserId: 55 })).resolves.toBeNull()
  })

  test("invited organisers get competition read access", async () => {
    const { t, competitionId, token } = await setupInvite()
    const result = await signInWithWca(t, {
      wcaUserId: 77,
      inviteToken: token,
    })
    const organiser = t.withIdentity({
      subject: expectSignedIn(result),
    })

    const competition = await organiser.query(
      api.competitions.queries.getPageRoot,
      { id: competitionId }
    )
    expect(competition).not.toBeNull()
  })
})
