/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import {
  addUserToTeam,
  insertTestUser,
  seedVolunteerTestUser,
} from "@/convex/testHelpers"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"

describe("refunds security", () => {
  test("delegates can list volunteers", async () => {
    const t = convexTest(schema, modules)
    const delegateId = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Delegate User")
      await addUserToTeam(ctx, userId, TEAM_NAMES.DELEGATES)
      return userId
    })
    await t.run(async (ctx) => {
      await ctx.db.insert("refundVolunteers", {
        name: "Refund Volunteer",
        wcaId: "2024TEST01",
        transferToWcaIds: [],
        archived: false,
      })
    })

    const delegate = t.withIdentity({ subject: delegateId })
    const volunteers = await delegate.query(
      api.plugins.refunds.api.listVolunteers,
      {}
    )
    expect(volunteers.length).toBe(1)
    expect(volunteers[0]?.name).toBe("Refund Volunteer")
  })

  test("volunteers cannot list volunteers", async () => {
    const t = convexTest(schema, modules)
    const volunteerId = await t.run(async (ctx) => seedVolunteerTestUser(ctx))
    const volunteer = t.withIdentity({ subject: volunteerId })

    await expect(
      volunteer.query(api.plugins.refunds.api.listVolunteers, {})
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
  })

  test("delegates can create, update, and delete volunteer records", async () => {
    const t = convexTest(schema, modules)
    const delegateId = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Managing Delegate")
      await addUserToTeam(ctx, userId, TEAM_NAMES.DELEGATES)
      return userId
    })
    const delegate = t.withIdentity({ subject: delegateId })

    const volunteerId = await delegate.mutation(
      api.plugins.refunds.api.createVolunteer,
      {
        name: "Managed Volunteer",
        wcaId: "2024MANA01",
        transferToWcaIds: [],
      }
    )

    await delegate.mutation(api.plugins.refunds.api.updateVolunteer, {
      id: volunteerId,
      name: "Managed Volunteer Updated",
      transferToWcaIds: ["2020MOVE01"],
    })

    const beforeDelete = await delegate.query(
      api.plugins.refunds.api.listVolunteers,
      {}
    )
    expect(
      beforeDelete.some(
        (volunteer: { id: string }) => volunteer.id === volunteerId
      )
    ).toBe(true)

    await delegate.mutation(api.plugins.refunds.api.deleteVolunteer, {
      id: volunteerId,
    })
    const afterDelete = await delegate.query(
      api.plugins.refunds.api.listVolunteers,
      {}
    )
    expect(
      afterDelete.some(
        (volunteer: { id: string }) => volunteer.id === volunteerId
      )
    ).toBe(false)
  })

  test("volunteers cannot create volunteer records", async () => {
    const t = convexTest(schema, modules)
    const volunteerId = await t.run(async (ctx) => seedVolunteerTestUser(ctx))
    const volunteer = t.withIdentity({ subject: volunteerId })

    await expect(
      volunteer.mutation(api.plugins.refunds.api.createVolunteer, {
        name: "Sneaky Volunteer",
        wcaId: "2024SNKY01",
      })
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
  })

  test("volunteers cannot compute refunds", async () => {
    const t = convexTest(schema, modules)
    const volunteerId = await t.run(async (ctx) => seedVolunteerTestUser(ctx))
    const volunteer = t.withIdentity({ subject: volunteerId })

    await expect(
      volunteer.action(api.plugins.refunds.actions.computeRefunds, {})
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
  })

  test("delegates pass auth for compute refunds — fail at missing WCA token", async () => {
    const t = convexTest(schema, modules)
    const delegateId = await t.run(async (ctx) => {
      const userId = await insertTestUser(ctx, "Computing Delegate")
      await addUserToTeam(ctx, userId, TEAM_NAMES.DELEGATES)
      return userId
    })
    const delegate = t.withIdentity({ subject: delegateId })

    // Auth passes; failure is expected at WCA token fetch in test env.
    await expect(
      delegate.action(api.plugins.refunds.actions.computeRefunds, {})
    ).rejects.toMatchObject({ data: { code: "PRECONDITION_FAILED" } })
  })
})
