/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"
import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import { seedTemplateCompetition } from "@/convex/testHelpers"
import type { NotificationEvent } from "@/convex/notifications/validators"
import { defaultMappings } from "@/convex/phases/wcaMappingModel"
import { pickRenameCandidate } from "@/convex/plugins/wca/competitionStatus"
import type {
  WcaCompetitionObservation,
  WcaRenameOption,
} from "@/convex/plugins/wca/validators"

afterEach(() => {
  vi.restoreAllMocks()
})

const OLD_ID = "NewYearNewCubeNewbridge202"
const NEW_ID = "NewYearNewCubeNewbridge2027"
const DATES = { from: "2027-01-09", to: "2027-01-10" } as const
const NOW = Date.UTC(2026, 10, 23)

function option(overrides: Partial<WcaRenameOption> = {}): WcaRenameOption {
  return {
    id: NEW_ID,
    name: "New Year New Cube Newbridge 2027",
    url: `https://www.worldcubeassociation.org/competitions/${NEW_ID}`,
    startDate: DATES.from,
    endDate: DATES.to,
    ...overrides,
  }
}

async function seedLinked(
  t: TestConvex<typeof schema>,
  compDates: { from: string | null; to: string | null } = DATES
): Promise<Id<"competitions">> {
  const { competitionId } = await seedTemplateCompetition(t, {
    startingPhase: "pre-announcement",
    wcaCompetitionId: OLD_ID,
  })
  await t.run(async (ctx) => {
    await ctx.db.patch("competitions", competitionId, { compDates })
  })
  return competitionId
}

async function seedStoredStatus(
  t: TestConvex<typeof schema>,
  announced: boolean
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("wcaCompetitionStatuses", {
      wcaCompetitionId: OLD_ID,
      confirmed: true,
      announced,
      cancelled: false,
      resultsPosted: false,
      startDate: DATES.from,
      endDate: DATES.to,
      registrationCloseAt: null,
      refundDeadlineAt: null,
      fetchedAt: NOW,
    })
  })
}

function recordMissing(
  t: TestConvex<typeof schema>,
  options: WcaRenameOption[] = [option()]
) {
  return t.mutation(
    internal.plugins.wca.statusSyncMutations.recordMissingWcaCompetition,
    { wcaCompetitionId: OLD_ID, options, detectedAt: NOW }
  )
}

function listIssues(t: TestConvex<typeof schema>) {
  return t.run(async (ctx) => await ctx.db.query("wcaLinkIssues").collect())
}

function brokenLinkEvents(t: TestConvex<typeof schema>) {
  return t.run(async (ctx) => {
    const scheduled = await ctx.db.system
      .query("_scheduled_functions")
      .collect()
    return scheduled
      .filter((entry) => entry.name.includes("dispatchEvent"))
      .map((entry) => (entry.args as [{ event: NotificationEvent }])[0].event)
      .filter((event) => event.kind === "wcaLinkBroken")
  })
}

describe("pickRenameCandidate", () => {
  const base = {
    startDate: DATES.from,
    endDate: DATES.to,
    isLinked: () => false,
  }

  test("suggests the one competition with the same dates", () => {
    expect(
      pickRenameCandidate({
        ...base,
        options: [
          option(),
          option({ id: "Other2027", startDate: "2027-02-01" }),
        ],
      })
    ).toEqual({ id: NEW_ID, name: option().name, url: option().url })
  })

  test("suggests nothing when several competitions share the dates", () => {
    expect(
      pickRenameCandidate({
        ...base,
        options: [option(), option({ id: "SameWeekend2027" })],
      })
    ).toBeNull()
  })

  test("skips competitions HQ has already linked", () => {
    expect(
      pickRenameCandidate({
        ...base,
        options: [option(), option({ id: "Linked2027" })],
        isLinked: (id) => id === "Linked2027",
      })
    ).toEqual(expect.objectContaining({ id: NEW_ID }))
  })

  test("suggests nothing without both dates", () => {
    expect(
      pickRenameCandidate({ ...base, endDate: null, options: [option()] })
    ).toBeNull()
  })
})

describe("broken WCA links", () => {
  test("records the issue with a rename candidate and notifies once", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await seedLinked(t)

    await recordMissing(t)
    await recordMissing(t)

    const issues = await listIssues(t)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      competitionId,
      wcaCompetitionId: OLD_ID,
      detectedAt: NOW,
      renameCandidate: { id: NEW_ID },
      mayBeHidden: true,
    })
    const events = await brokenLinkEvents(t)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      kind: "wcaLinkBroken",
      competitionId,
      wcaCompetitionId: OLD_ID,
      renameCandidate: { id: NEW_ID },
      mayBeHidden: true,
    })
  })

  test("treats a 404 for an unannounced competition as possibly hidden", async () => {
    const t = convexTest(schema, modules)
    await seedLinked(t)
    await seedStoredStatus(t, false)

    await recordMissing(t)

    expect((await listIssues(t))[0]?.mayBeHidden).toBe(true)
  })

  test("treats a 404 for an announced competition as gone", async () => {
    const t = convexTest(schema, modules)
    await seedLinked(t)
    await seedStoredStatus(t, true)

    await recordMissing(t)

    expect((await listIssues(t))[0]?.mayBeHidden).toBe(false)
    expect((await brokenLinkEvents(t))[0]?.mayBeHidden).toBe(false)
  })

  test("does not suggest a competition another HQ competition links to", async () => {
    const t = convexTest(schema, modules)
    await seedLinked(t)
    await seedTemplateCompetition(t, { wcaCompetitionId: NEW_ID })

    await recordMissing(t)

    expect((await listIssues(t))[0]?.renameCandidate).toBeNull()
  })

  test("ignores competitions that have already been held", async () => {
    const t = convexTest(schema, modules)
    await seedLinked(t, { from: "2026-01-09", to: "2026-01-10" })

    await recordMissing(t)

    expect(await listIssues(t)).toEqual([])
    expect(await brokenLinkEvents(t)).toEqual([])
  })

  test("only lists ids of competitions not yet held", async () => {
    const t = convexTest(schema, modules)
    await seedLinked(t)
    await seedTemplateCompetition(t, { wcaCompetitionId: "Past2026" })
    await t.run(async (ctx) => {
      const past = await ctx.db
        .query("competitions")
        .withIndex("by_wcaCompetitionId", (q) =>
          q.eq("wcaCompetitionId", "Past2026")
        )
        .unique()
      if (past === null) throw new Error("missing seed")
      await ctx.db.patch("competitions", past._id, {
        compDates: { from: "2026-03-01", to: "2026-03-01" },
      })
    })

    const upcoming = await t.query(
      internal.plugins.wca.statusSyncMutations.listUpcomingLinkedIds,
      { wcaCompetitionIds: [OLD_ID, "Past2026"], nowMs: NOW }
    )

    expect(upcoming).toEqual([OLD_ID])
  })

  test("clears the issue once the WCA finds the competition again", async () => {
    const t = convexTest(schema, modules)
    await seedLinked(t)
    await recordMissing(t)

    const observation: WcaCompetitionObservation = {
      wcaCompetitionId: OLD_ID,
      confirmed: true,
      announced: false,
      cancelled: false,
      resultsPosted: false,
      startDate: DATES.from,
      endDate: DATES.to,
      registrationCloseAt: null,
      refundDeadlineAt: null,
      fetchedAt: NOW,
    }
    await t.mutation(
      internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
      { observation, mappings: defaultMappings() }
    )

    expect(await listIssues(t)).toEqual([])
  })

  test("clears the issue when the competition is relinked", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await seedLinked(t)
    await recordMissing(t)

    await t.mutation(internal.plugins.wca.competitionLink.saveCompetitionLink, {
      competitionId,
      wcaCompetitionId: NEW_ID,
      name: option().name,
      url: option().url,
    })

    expect(await listIssues(t)).toEqual([])
  })

  test("posts the warning to the competition's Discord channel", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await seedLinked(t)
    await t.run(async (ctx) => {
      await ctx.db.insert("objectLinkedResources", {
        object: { type: "competitions", id: competitionId },
        resourceType: "discordChannel",
        resourceKey: "default",
        data: {
          resourceType: "discordChannel",
          channelId: "comp-channel",
          channelName: "newbridge",
          guildId: "guild-1",
        },
      })
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "wcaLinkBroken",
          competitionId,
          wcaCompetitionId: OLD_ID,
          renameCandidate: {
            id: NEW_ID,
            name: option().name,
            url: option().url,
          },
          mayBeHidden: false,
        },
      }
    )

    expect(drafts.map((draft) => draft.target)).toEqual([
      { kind: "discordChannel", channelId: "comp-channel" },
    ])
    const embed = drafts[0].embeds[0]
    expect(embed.description).toContain(`\`${OLD_ID}\` no longer exists`)
    expect(embed.fields?.map((field) => field.value)).toEqual([
      `\`${OLD_ID}\``,
      `[${option().name}](${option().url})`,
    ])
  })

  test("says the competition may only be hidden when that is possible", async () => {
    const t = convexTest(schema, modules)
    const competitionId = await seedLinked(t)
    await t.run(async (ctx) => {
      await ctx.db.insert("objectLinkedResources", {
        object: { type: "competitions", id: competitionId },
        resourceType: "discordChannel",
        resourceKey: "default",
        data: {
          resourceType: "discordChannel",
          channelId: "comp-channel",
          channelName: "newbridge",
          guildId: "guild-1",
        },
      })
    })

    const drafts = await t.query(
      internal.notifications.model.resolveEventDrafts,
      {
        event: {
          kind: "wcaLinkBroken",
          competitionId,
          wcaCompetitionId: OLD_ID,
          renameCandidate: null,
          mayBeHidden: true,
        },
      }
    )

    const description = drafts[0]?.embeds[0]?.description
    expect(description).toContain(`The WCA cannot find \`${OLD_ID}\``)
    expect(description).toContain("does not manage it")
    expect(description).toContain("connect a WCA account that manages it")
  })
})

function requestUrl(input: unknown): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  if (input instanceof Request) return input.url
  return ""
}

describe("WCA status sync with a renamed competition", () => {
  async function seedSync(detailStatus: number) {
    const t = convexTest(schema, modules)
    const competitionId = await seedLinked(t)
    await t.run(async (ctx) => {
      await ctx.db.insert("serviceTokens", {
        service: "wca",
        accessToken: "wca-access-token",
        refreshToken: "wca-refresh-token",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      })
    })
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = requestUrl(input)
        if (url.includes("/competitions/mine")) {
          return Response.json({
            past_competitions: [],
            future_competitions: [
              {
                id: NEW_ID,
                name: option().name,
                website: "",
                start_date: DATES.from,
                end_date: DATES.to,
                registration_open: "",
                url: option().url,
                city: "Newbridge",
                short_display_name: option().name,
                championships: [],
                "visible?": true,
                "confirmed?": true,
                "cancelled?": false,
                "results_posted?": false,
                "report_posted?": false,
              },
            ],
            bookmarked_competitions: [],
            registrations_by_competition: {},
          })
        }
        if (url.includes("/competition_index")) return Response.json([])
        if (url.includes(`/competitions/${OLD_ID}`)) {
          if (detailStatus === 200) {
            return Response.json({ id: OLD_ID, name: "Still here" })
          }
          return Response.json(
            { error: "Not found", data: { model: "Competition", id: OLD_ID } },
            { status: detailStatus }
          )
        }
        throw new Error(`Unexpected fetch to ${url}`)
      })
    return { t, competitionId, fetchMock }
  }

  test("flags a linked id the WCA answers 404 for", async () => {
    const { t, competitionId } = await seedSync(404)

    const result = await t.action(
      internal.plugins.wca.statusSync.syncCompetitionStatuses,
      {}
    )

    expect(result.missing).toEqual([OLD_ID])
    const issues = await listIssues(t)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      competitionId,
      wcaCompetitionId: OLD_ID,
      renameCandidate: { id: NEW_ID },
    })
  })

  test("does not flag the link when the WCA fails for another reason", async () => {
    const { t } = await seedSync(500)

    const result = await t.action(
      internal.plugins.wca.statusSync.syncCompetitionStatuses,
      {}
    )

    expect(result.missing).toEqual([])
    expect(await listIssues(t)).toEqual([])
  })

  test("clears the issue when only the per-competition check finds it", async () => {
    const { t } = await seedSync(200)
    await recordMissing(t)
    expect(await listIssues(t)).toHaveLength(1)

    const result = await t.action(
      internal.plugins.wca.statusSync.syncCompetitionStatuses,
      {}
    )

    expect(result.missing).toEqual([])
    expect(await listIssues(t)).toEqual([])
  })
})
