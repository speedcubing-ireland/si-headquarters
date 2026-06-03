/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import {
  addUserToTeam,
  insertTestUser,
  seedDirectorUser,
  seedVolunteerTestUser,
} from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"

const discordMember = {
  discordUserId: "discord-1",
  discordUsername: "cube_fan",
  discordDisplayName: "Cube Fan",
  discordAvatarHash: "avatar-hash",
}

describe("admin user management", () => {
  test("director can link and unlink Discord account", async () => {
    const t = convexTest(schema, modules)
    const { directorId, targetUserId } = await t.run(async (ctx) => {
      const directorId = await seedDirectorUser(ctx)
      const targetUserId = await insertTestUser(ctx, "Target User")
      return { directorId, targetUserId }
    })
    const director = t.withIdentity({ subject: directorId })

    await director.mutation(api.users.mutations.updateForAdmin, {
      userId: targetUserId,
      disabled: false,
      teamIds: [],
      discord: { kind: "link", member: discordMember },
    })

    const linked = await director.query(api.users.queries.getForAdmin, {
      userId: targetUserId,
    })
    expect(linked?.discordUserId).toBe(discordMember.discordUserId)
    expect(linked?.discordUsername).toBe(discordMember.discordUsername)

    await director.mutation(api.users.mutations.updateForAdmin, {
      userId: targetUserId,
      disabled: false,
      teamIds: [],
      discord: { kind: "unlink" },
    })

    const unlinked = await director.query(api.users.queries.getForAdmin, {
      userId: targetUserId,
    })
    expect(unlinked?.discordUserId).toBeUndefined()
  })

  test("duplicate Discord ID cannot be linked to another user", async () => {
    const t = convexTest(schema, modules)
    const { directorId, firstUserId, secondUserId } = await t.run(
      async (ctx) => {
        const directorId = await seedDirectorUser(ctx)
        const firstUserId = await insertTestUser(ctx, "First")
        const secondUserId = await insertTestUser(ctx, "Second")
        return { directorId, firstUserId, secondUserId }
      }
    )
    const director = t.withIdentity({ subject: directorId })

    await director.mutation(api.users.mutations.updateForAdmin, {
      userId: firstUserId,
      disabled: false,
      teamIds: [],
      discord: { kind: "link", member: discordMember },
    })

    await expect(
      director.mutation(api.users.mutations.updateForAdmin, {
        userId: secondUserId,
        disabled: false,
        teamIds: [],
        discord: { kind: "link", member: discordMember },
      })
    ).rejects.toMatchObject({
      data: { code: "CONFLICT" },
    })
  })

  test("non-admin cannot call user management mutations", async () => {
    const t = convexTest(schema, modules)
    const { volunteerId, targetUserId } = await t.run(async (ctx) => {
      const volunteerId = await seedVolunteerTestUser(ctx)
      const targetUserId = await insertTestUser(ctx, "Target")
      return { volunteerId, targetUserId }
    })
    const volunteer = t.withIdentity({ subject: volunteerId })

    await expect(
      volunteer.mutation(api.users.mutations.updateForAdmin, {
        userId: targetUserId,
        disabled: true,
        teamIds: [],
        discord: { kind: "link", member: discordMember },
      })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  })

  test("setDisabled rejects self-disable", async () => {
    const t = convexTest(schema, modules)
    const directorId = await t.run(async (ctx) => seedDirectorUser(ctx))
    const director = t.withIdentity({ subject: directorId })

    await expect(
      director.mutation(api.users.mutations.updateForAdmin, {
        userId: directorId,
        disabled: true,
        teamIds: [],
        discord: { kind: "unchanged" },
      })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  })

  test("disabled users remain denied by existing principal gates", async () => {
    const t = convexTest(schema, modules)
    const { directorId, targetUserId } = await t.run(async (ctx) => {
      const directorId = await seedDirectorUser(ctx)
      const targetUserId = await insertTestUser(ctx, "Disabled volunteer")
      await addUserToTeam(ctx, targetUserId, TEAM_NAMES.VOLUNTEER)
      return { directorId, targetUserId }
    })
    const director = t.withIdentity({ subject: directorId })

    await director.mutation(api.users.mutations.updateForAdmin, {
      userId: targetUserId,
      disabled: true,
      teamIds: [],
      discord: { kind: "unchanged" },
    })

    const disabled = t.withIdentity({ subject: targetUserId })
    await expect(
      disabled.query(api.phases.queries.list, {})
    ).rejects.toMatchObject({
      data: { code: "UNAUTHENTICATED" },
    })
  })
})
