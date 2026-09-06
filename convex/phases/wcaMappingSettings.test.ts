/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import {
  seedDirectorUser,
  seedVolunteerTestUser,
  TEMPLATE_PHASES,
} from "@/convex/testHelpers"
import {
  WCA_MILESTONES,
  type WcaMilestone,
} from "@/convex/phases/wcaMilestones"
import { defaultMappings } from "@/convex/phases/wcaMappingModel"

async function asDirector(t: TestConvex<typeof schema>) {
  const userId = await t.run(async (ctx) => seedDirectorUser(ctx))
  return t.withIdentity({ subject: userId })
}

async function asVolunteer(t: TestConvex<typeof schema>) {
  const userId = await t.run(async (ctx) => seedVolunteerTestUser(ctx))
  return t.withIdentity({ subject: userId })
}

/**
 * A full mapping with the named milestones overridden and the rest unmapped, so
 * each failure case shows only the entries that are the point of the test.
 */
function mappingsWith(overrides: Partial<Record<WcaMilestone, string | null>>) {
  return WCA_MILESTONES.map((milestone) => ({
    milestone,
    phaseKey: overrides[milestone] ?? null,
  }))
}

describe("get", () => {
  test("returns the template defaults when nothing is stored", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})

    expect(settings.isCustomised).toBe(false)
    expect(settings.mappings).toEqual(defaultMappings())
    expect(settings.phases.map((phase) => phase.key)).toEqual(
      TEMPLATE_PHASES.map((phase) => phase.key)
    )
  })

  test("returns one entry per milestone, in ladder order", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})

    expect(settings.mappings.map((mapping) => mapping.milestone)).toEqual([
      ...WCA_MILESTONES,
    ])
  })

  test("is refused for a non-director", async () => {
    const t = convexTest(schema, modules)
    const volunteer = await asVolunteer(t)

    await expect(
      volunteer.query(api.phases.wcaMappingSettings.get, {})
    ).rejects.toThrow()
  })
})

describe("update", () => {
  test("stores an override and reports it as customised", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await director.mutation(api.phases.wcaMappingSettings.update, {
      mappings: mappingsWith({
        confirmed: "pre-announcement",
        announced: "announced",
        registrationClosed: "pre-competition",
        held: "post-competition",
        resultsPosted: "completed",
      }),
    })

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})
    expect(settings.isCustomised).toBe(true)
    expect(
      settings.mappings.find((m) => m.milestone === "confirmed")?.phaseKey
    ).toBe("pre-announcement")
  })

  test("rejects a mapping that puts a later milestone on an earlier phase", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await expect(
      director.mutation(api.phases.wcaMappingSettings.update, {
        mappings: mappingsWith({
          submitted: "completed",
          announced: "announced",
        }),
      })
    ).rejects.toThrow()
  })

  test("rejects mapping one phase to two milestones", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await expect(
      director.mutation(api.phases.wcaMappingSettings.update, {
        mappings: mappingsWith({
          submitted: "announced",
          announced: "announced",
        }),
      })
    ).rejects.toThrow()
  })

  test("rejects a phase key the template does not have", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await expect(
      director.mutation(api.phases.wcaMappingSettings.update, {
        mappings: mappingsWith({ submitted: "not-a-real-phase" }),
      })
    ).rejects.toThrow()
  })

  test("accepts a mapping that leaves every milestone unmapped", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await director.mutation(api.phases.wcaMappingSettings.update, {
      mappings: mappingsWith({}),
    })

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})
    expect(settings.mappings.every((m) => m.phaseKey === null)).toBe(true)
  })

  test("is refused for a non-director", async () => {
    const t = convexTest(schema, modules)
    const volunteer = await asVolunteer(t)

    await expect(
      volunteer.mutation(api.phases.wcaMappingSettings.update, {
        mappings: defaultMappings(),
      })
    ).rejects.toThrow()
  })
})

describe("resetToDefaults", () => {
  test("drops the override so the template defaults apply again", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await director.mutation(api.phases.wcaMappingSettings.update, {
      mappings: mappingsWith({}),
    })
    await director.mutation(api.phases.wcaMappingSettings.resetToDefaults, {})

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})
    expect(settings.isCustomised).toBe(false)
    expect(settings.mappings).toEqual(defaultMappings())
  })

  test("is a no-op when nothing is stored", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await expect(
      director.mutation(api.phases.wcaMappingSettings.resetToDefaults, {})
    ).resolves.toBeNull()
  })
})
