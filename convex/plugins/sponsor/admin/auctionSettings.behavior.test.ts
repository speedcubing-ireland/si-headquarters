import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import { seedDirectorUser } from "@/convex/testHelpers"
import {
  DEFAULT_DURATION_HOURS,
  DEFAULT_START_DELAY_HOURS,
} from "./auctionSettings"

describe("auctionSettings", () => {
  test("get returns defaults when no settings have been saved", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    const settings = await manager.query(
      api.plugins.sponsor.admin.auctionSettings.get,
      {}
    )

    expect(settings.startDelayHours).toBe(DEFAULT_START_DELAY_HOURS)
    expect(settings.durationHours).toBe(DEFAULT_DURATION_HOURS)
  })

  test("update persists new values and get reflects them", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    await manager.mutation(api.plugins.sponsor.admin.auctionSettings.update, {
      startDelayHours: 3,
      durationHours: 2,
    })

    const settings = await manager.query(
      api.plugins.sponsor.admin.auctionSettings.get,
      {}
    )

    expect(settings.startDelayHours).toBe(3)
    expect(settings.durationHours).toBe(2)
  })

  test("update is idempotent — subsequent calls overwrite previous values", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    await manager.mutation(api.plugins.sponsor.admin.auctionSettings.update, {
      startDelayHours: 3,
      durationHours: 2,
    })
    await manager.mutation(api.plugins.sponsor.admin.auctionSettings.update, {
      startDelayHours: 5,
      durationHours: 4,
    })

    const settings = await manager.query(
      api.plugins.sponsor.admin.auctionSettings.get,
      {}
    )

    expect(settings.startDelayHours).toBe(5)
    expect(settings.durationHours).toBe(4)
  })

  test("update rejects zero start delay", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    await expect(
      manager.mutation(api.plugins.sponsor.admin.auctionSettings.update, {
        startDelayHours: 0,
        durationHours: 1,
      })
    ).rejects.toBeTruthy()
  })

  test("update rejects zero duration", async () => {
    const t = convexTest(schema, modules)
    const managerId = await t.run((ctx) => seedDirectorUser(ctx))
    const manager = t.withIdentity({ subject: managerId })

    await expect(
      manager.mutation(api.plugins.sponsor.admin.auctionSettings.update, {
        startDelayHours: 1,
        durationHours: 0,
      })
    ).rejects.toBeTruthy()
  })

  test("get is denied for unauthenticated callers", async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.query(api.plugins.sponsor.admin.auctionSettings.get, {})
    ).rejects.toBeTruthy()
  })

  test("update is denied for unauthenticated callers", async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(api.plugins.sponsor.admin.auctionSettings.update, {
        startDelayHours: 1,
        durationHours: 1,
      })
    ).rejects.toBeTruthy()
  })
})
