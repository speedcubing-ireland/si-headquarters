import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { addUserToTeam, insertTestUser } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"

afterEach(() => {
  vi.restoreAllMocks()
})

async function setupEventReport() {
  const t = convexTest(schema, modules)
  const volunteerId = await t.run(async (ctx) => {
    const userId = await insertTestUser(ctx, "Volunteer")
    await addUserToTeam(ctx, userId, TEAM_NAMES.VOLUNTEER)
    const competitionId = await ctx.db.insert("competitions", {
      name: "Irish Open",
      description: null,
      people: {
        compLead: null,
        leadDelegate: null,
        organisers: [],
      },
      compDates: { from: "2026-09-12", to: "2026-09-13" },
      phaseId: null,
    })
    await ctx.db.insert("objectLinkedResources", {
      object: { type: "competitions", id: competitionId },
      resourceType: "googleSheet",
      resourceKey: "default",
      data: {
        resourceType: "googleSheet",
        sheetId: "sheet-id",
        title: "Irish Open schedule",
        url: "https://docs.google.com/spreadsheets/d/sheet-id",
      },
    })
    await ctx.db.insert("serviceTokens", {
      service: "google",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    })
    return userId
  })
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    Response.json({
      valueRanges: [
        {
          range: "Schedule!A2:F",
          values: [
            ["3x3", "4"],
            ["Pyraminx", "2"],
          ],
        },
      ],
    })
  )
  const client = t.withIdentity({ subject: volunteerId })
  const initial = await client.action(api.events.actions.loadReport, {})
  expect(initial[0]).toMatchObject({
    events: [
      { eventId: "333", rounds: 4 },
      { eventId: "pyram", rounds: 2 },
    ],
    error: null,
  })
  return {
    client,
    fetchMock,
    initial,
    removeGoogleToken: async () => {
      await t.run(async (ctx) => {
        const token = await ctx.db
          .query("serviceTokens")
          .withIndex("by_service", (q) => q.eq("service", "google"))
          .unique()
        if (token !== null) {
          await ctx.db.delete("serviceTokens", token._id)
        }
      })
    },
  }
}

describe("event report loading", () => {
  test("persists canonical schedule data and reads only progression rows", async () => {
    const { client, fetchMock, initial } = await setupEventReport()

    const firstRequestInput = fetchMock.mock.calls[0]?.[0]
    expect(typeof firstRequestInput).toBe("string")
    if (typeof firstRequestInput !== "string") {
      throw new Error("Expected the Sheets request URL to be a string.")
    }
    const firstRequest = new URL(firstRequestInput)
    expect(firstRequest.searchParams.getAll("ranges")).toEqual([
      "Schedule!A2:F",
    ])

    const cached = await client.action(api.events.actions.loadReport, {})
    expect(cached).toEqual(initial)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("serves stale snapshots when the Google token is unavailable", async () => {
    const { client, fetchMock, initial, removeGoogleToken } =
      await setupEventReport()
    await removeGoogleToken()

    const stale = await client.action(api.events.actions.loadReport, {
      skipCache: true,
    })

    expect(stale[0]?.events).toEqual(initial[0]?.events)
    expect(stale[0]?.fetchedAt).toBe(initial[0]?.fetchedAt)
    expect(stale[0]?.error).toMatch(/not connected/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("serves stale snapshots when Google Sheets is unavailable", async () => {
    const { client, fetchMock, initial } = await setupEventReport()
    fetchMock.mockRejectedValueOnce(new Error("Google unavailable"))

    const stale = await client.action(api.events.actions.loadReport, {
      skipCache: true,
    })

    expect(stale[0]).toMatchObject({
      events: initial[0]?.events,
      fetchedAt: initial[0]?.fetchedAt,
      error: "Google unavailable",
    })
  })
})
