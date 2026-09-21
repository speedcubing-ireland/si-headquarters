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
        refundDeadlinePassed: "pre-competition",
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

describe("refund deadline default", () => {
  const phaseKeyFor = (
    settings: {
      mappings: { milestone: WcaMilestone; phaseKey: string | null }[]
    },
    milestone: WcaMilestone
  ) =>
    settings.mappings.find((mapping) => mapping.milestone === milestone)
      ?.phaseKey

  test("Pre-Competition is backed by the refund deadline, not registration close", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})
    expect(phaseKeyFor(settings, "refundDeadlinePassed")).toBe(
      "pre-competition"
    )
    // Left unmapped by default, like `confirmed`: registration closing is no
    // longer enough on its own to move a competition on.
    expect(phaseKeyFor(settings, "registrationClosed")).toBeNull()
  })

  test("a row stored before the milestone existed keeps its other entries", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    // What an org that had customised the mapping already has stored: no
    // `refundDeadlinePassed` entry at all.
    await t.run(async (ctx) => {
      await ctx.db.insert("wcaPhaseMappings", {
        key: "default",
        mappings: [
          { milestone: "announced", phaseKey: "announced" },
          { milestone: "registrationClosed", phaseKey: "pre-competition" },
          { milestone: "held", phaseKey: "post-competition" },
        ],
        updatedById: await seedDirectorUser(ctx),
        updatedAt: Date.now(),
      })
    })

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})
    // Their existing behaviour is untouched until someone edits or resets it.
    expect(phaseKeyFor(settings, "registrationClosed")).toBe("pre-competition")
    expect(phaseKeyFor(settings, "refundDeadlinePassed")).toBeNull()
    expect(phaseKeyFor(settings, "held")).toBe("post-competition")
  })

  test("both milestones may be mapped, in ladder order", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await director.mutation(api.phases.wcaMappingSettings.update, {
      mappings: mappingsWith({
        registrationClosed: "announced",
        refundDeadlinePassed: "pre-competition",
      }),
    })

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})
    expect(settings.isCustomised).toBe(true)
  })

  test("rejects the refund deadline on a phase before registration close's", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await expect(
      director.mutation(api.phases.wcaMappingSettings.update, {
        mappings: mappingsWith({
          registrationClosed: "pre-competition",
          refundDeadlinePassed: "announced",
        }),
      })
    ).rejects.toThrow()
  })

  test("rejects both milestones pointing at the same phase", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await expect(
      director.mutation(api.phases.wcaMappingSettings.update, {
        mappings: mappingsWith({
          registrationClosed: "pre-competition",
          refundDeadlinePassed: "pre-competition",
        }),
      })
    ).rejects.toThrow()
  })

  test("reset restores the refund-deadline default", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await director.mutation(api.phases.wcaMappingSettings.update, {
      mappings: mappingsWith({ registrationClosed: "pre-competition" }),
    })
    await director.mutation(api.phases.wcaMappingSettings.resetToDefaults, {})

    const settings = await director.query(api.phases.wcaMappingSettings.get, {})
    expect(settings.isCustomised).toBe(false)
    expect(settings.mappings).toEqual(defaultMappings())
  })
})

/**
 * The mapping this deployment actually runs, as of the report that prompted
 * `getEffective` to exist. It differs from the template defaults in exactly the
 * ways the help page was getting wrong: `held` moves nothing, and it is
 * `resultsPosted` rather than `held` that reaches Post-Competition.
 */
const PRODUCTION_MAPPINGS = mappingsWith({
  submitted: "pre-announcement",
  announced: "announced",
  refundDeadlinePassed: "pre-competition",
  resultsPosted: "post-competition",
})

describe("getEffective", () => {
  test("is readable by a non-director, unlike get", async () => {
    const t = convexTest(schema, modules)
    const volunteer = await asVolunteer(t)

    const settings = await volunteer.query(
      api.phases.wcaMappingSettings.getEffective,
      {}
    )

    expect(settings.mappings).toEqual(defaultMappings())
    expect(settings.isCustomised).toBe(false)
  })

  test("is refused without an identity", async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.query(api.phases.wcaMappingSettings.getEffective, {})
    ).rejects.toThrow()
  })

  test("shows a reader the director's override, not the template", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)
    const volunteer = await asVolunteer(t)

    await director.mutation(api.phases.wcaMappingSettings.update, {
      mappings: PRODUCTION_MAPPINGS,
    })

    const settings = await volunteer.query(
      api.phases.wcaMappingSettings.getEffective,
      {}
    )
    const phaseFor = (milestone: WcaMilestone) =>
      settings.mappings.find((mapping) => mapping.milestone === milestone)
        ?.phaseKey

    expect(settings.isCustomised).toBe(true)
    expect(phaseFor("held")).toBeNull()
    expect(phaseFor("resultsPosted")).toBe("post-competition")
  })

  test("agrees with get, so the two views cannot drift", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)
    const volunteer = await asVolunteer(t)

    await director.mutation(api.phases.wcaMappingSettings.update, {
      mappings: PRODUCTION_MAPPINGS,
    })

    const adminView = await director.query(
      api.phases.wcaMappingSettings.get,
      {}
    )
    const readerView = await volunteer.query(
      api.phases.wcaMappingSettings.getEffective,
      {}
    )

    expect(readerView.mappings).toEqual(adminView.mappings)
    expect(readerView.isCustomised).toBe(adminView.isCustomised)
  })

  test("withholds updatedAt, which stays director-only", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)
    const volunteer = await asVolunteer(t)

    await director.mutation(api.phases.wcaMappingSettings.update, {
      mappings: PRODUCTION_MAPPINGS,
    })

    const settings = await volunteer.query(
      api.phases.wcaMappingSettings.getEffective,
      {}
    )

    expect(settings).not.toHaveProperty("updatedAt")
    expect(settings).not.toHaveProperty("updatedById")
  })
})
