/// <reference types="vite/client" />

import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { ensureVolunteerMembership } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

describe("competition calendar", () => {
  test("shows competition instead of weekend placeholder", async () => {
    const t = convexTest(schema, modules)
    const viewerId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Viewer",
      })
      await ensureVolunteerMembership(ctx, userId)
      return userId
    })
    const user = t.withIdentity({ subject: viewerId })

    await t.run(async (ctx) => {
      await ctx.db.insert("competitions", {
        name: "Spring Open",
        description: null,
        people: {
          compLead: null,
          leadDelegate: null,
          organisers: [],
        },
        compDates: {
          from: "2025-03-14",
          to: "2025-03-16",
        },
        phaseId: null,
        updateId: null,
      })
    })

    const { rows } = await user.query(api.competitions.calendar.listForYear, {
      year: 2025,
    })

    const march15Weekend = rows.find(
      (row) => row.kind === "weekend" && row.weekendStart === "2025-03-15"
    )
    const springOpen = rows.find(
      (row) => row.kind === "competition" && row.name === "Spring Open"
    )

    expect(march15Weekend).toBeUndefined()
    expect(springOpen).toBeDefined()
  })

  test("weekend placeholder includes slot flags", async () => {
    const t = convexTest(schema, modules)
    const viewerId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Viewer",
      })
      await ensureVolunteerMembership(ctx, userId)
      return userId
    })
    const user = t.withIdentity({ subject: viewerId })

    await t.run(async (ctx) => {
      await ctx.db.insert("competitionWeekendSlots", {
        year: 2025,
        weekendStart: "2025-01-04",
        note: "Hold for nationals",
        announced: true,
        reserved: false,
      })
    })

    const { rows } = await user.query(api.competitions.calendar.listForYear, {
      year: 2025,
    })

    const slot = rows.find(
      (row) => row.kind === "weekend" && row.weekendStart === "2025-01-04"
    )

    expect(slot).toMatchObject({
      kind: "weekend",
      note: "Hold for nationals",
      announced: true,
      reserved: false,
    })
  })
})
