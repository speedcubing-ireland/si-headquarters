/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import { seedDirectorUser, seedVolunteerTestUser } from "@/convex/testHelpers"
import { WCA_MILESTONES } from "@/convex/phases/wcaMilestones"

async function asDirector(t: TestConvex<typeof schema>) {
  const userId = await t.run(async (ctx) => seedDirectorUser(ctx))
  return t.withIdentity({ subject: userId })
}

async function asVolunteer(t: TestConvex<typeof schema>) {
  const userId = await t.run(async (ctx) => seedVolunteerTestUser(ctx))
  return t.withIdentity({ subject: userId })
}

/** A valid, monotonic mapping to mutate in the failure cases. */
const VALID_MAPPINGS = [
  { milestone: "submitted", phaseKey: "pre-announcement" },
  { milestone: "confirmed", phaseKey: null },
  { milestone: "announced", phaseKey: "announced" },
  { milestone: "registrationClosed", phaseKey: "pre-competition" },
  { milestone: "held", phaseKey: "post-competition" },
  { milestone: "resultsPosted", phaseKey: "completed" },
] as const

describe("get", () => {
  test("returns the template defaults when nothing is stored", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})

    expect(settings.isCustomised).toBe(false)
    expect(settings.mappings).toEqual([...VALID_MAPPINGS])
    expect(settings.phases.map((phase) => phase.key)).toEqual([
      "concept",
      "pre-announcement",
      "announced",
      "pre-competition",
      "post-competition",
      "completed",
    ])
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
      mappings: VALID_MAPPINGS.map((mapping) =>
        mapping.milestone === "confirmed"
          ? { milestone: "confirmed" as const, phaseKey: "pre-announcement" }
          : mapping.milestone === "submitted"
            ? { milestone: "submitted" as const, phaseKey: null }
            : mapping
      ),
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
        mappings: [
          { milestone: "submitted", phaseKey: "completed" },
          { milestone: "confirmed", phaseKey: null },
          { milestone: "announced", phaseKey: "announced" },
          { milestone: "registrationClosed", phaseKey: null },
          { milestone: "held", phaseKey: null },
          { milestone: "resultsPosted", phaseKey: null },
        ],
      })
    ).rejects.toThrow()
  })

  test("rejects mapping one phase to two milestones", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await expect(
      director.mutation(api.phases.wcaMappingSettings.update, {
        mappings: [
          { milestone: "submitted", phaseKey: "announced" },
          { milestone: "confirmed", phaseKey: null },
          { milestone: "announced", phaseKey: "announced" },
          { milestone: "registrationClosed", phaseKey: null },
          { milestone: "held", phaseKey: null },
          { milestone: "resultsPosted", phaseKey: null },
        ],
      })
    ).rejects.toThrow()
  })

  test("rejects a phase key the template does not have", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await expect(
      director.mutation(api.phases.wcaMappingSettings.update, {
        mappings: [
          { milestone: "submitted", phaseKey: "not-a-real-phase" },
          { milestone: "confirmed", phaseKey: null },
          { milestone: "announced", phaseKey: null },
          { milestone: "registrationClosed", phaseKey: null },
          { milestone: "held", phaseKey: null },
          { milestone: "resultsPosted", phaseKey: null },
        ],
      })
    ).rejects.toThrow()
  })

  test("accepts a mapping that leaves every milestone unmapped", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await director.mutation(api.phases.wcaMappingSettings.update, {
      mappings: WCA_MILESTONES.map((milestone) => ({
        milestone,
        phaseKey: null,
      })),
    })

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})
    expect(settings.mappings.every((m) => m.phaseKey === null)).toBe(true)
  })

  test("is refused for a non-director", async () => {
    const t = convexTest(schema, modules)
    const volunteer = await asVolunteer(t)

    await expect(
      volunteer.mutation(api.phases.wcaMappingSettings.update, {
        mappings: [...VALID_MAPPINGS],
      })
    ).rejects.toThrow()
  })
})

describe("resetToDefaults", () => {
  test("drops the override so the template defaults apply again", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await director.mutation(api.phases.wcaMappingSettings.update, {
      mappings: WCA_MILESTONES.map((milestone) => ({
        milestone,
        phaseKey: null,
      })),
    })
    await director.mutation(api.phases.wcaMappingSettings.resetToDefaults, {})

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})
    expect(settings.isCustomised).toBe(false)
    expect(settings.mappings).toEqual([...VALID_MAPPINGS])
  })

  test("is a no-op when nothing is stored", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await expect(
      director.mutation(api.phases.wcaMappingSettings.resetToDefaults, {})
    ).resolves.toBeNull()
  })
})
