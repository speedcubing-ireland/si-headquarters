import { api } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import {
  codeFromConvexError,
  unknownErrorMessage,
} from "@/convex/integrations/errorPayload"
import { TEAM_NAMES } from "@/convex/permissions/shared"
import { WCA_2FA_SECRET_ENV } from "@/convex/plugins/wca/definition"
import { addUserToTeam, insertTestUser } from "@/convex/testHelpers"
import { modules } from "@/convex/test.setup"
import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"

vi.mock(
  "@/config/lib/organisation",
  () => import("@/config/lib/organisation.testFixture")
)

const VALID_32CHAR_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"

describe("wca twoFactor", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test("returns 6-digit code and 30s period; payload never includes secret", async () => {
    vi.stubEnv(WCA_2FA_SECRET_ENV, VALID_32CHAR_SECRET)
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      const id = await insertTestUser(ctx, "Competitions")
      await addUserToTeam(ctx, id, TEAM_NAMES.COMPETITIONS)
      return id
    })

    const result = await t
      .withIdentity({ subject: userId })
      .action(api.plugins.wca.twoFactor.generateCode, {})

    const serializedResult = JSON.stringify(result)

    expect(result.code).toMatch(/^\d{6}$/)
    expect(result.periodSeconds).toBe(30)
    expect(result.digits).toBe(6)
    expect(serializedResult).not.toContain(VALID_32CHAR_SECRET)
    expect(Object.keys(result).sort()).toEqual(
      [
        "code",
        "digits",
        "expiresAtMs",
        "generatedAtMs",
        "periodSeconds",
        "serverNowMs",
      ].sort()
    )
  })

  test("error responses do not echo invalid secret values", async () => {
    const invalidSecret = "INVALID*SECRET"
    vi.stubEnv(WCA_2FA_SECRET_ENV, invalidSecret)
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      const id = await insertTestUser(ctx, "Competitions")
      await addUserToTeam(ctx, id, TEAM_NAMES.COMPETITIONS)
      return id
    })

    let caught: unknown
    try {
      await t
        .withIdentity({ subject: userId })
        .action(api.plugins.wca.twoFactor.generateCode, {})
    } catch (error) {
      caught = error
    }

    expect(caught).toBeTruthy()
    expect(codeFromConvexError(caught)).toBe("PRECONDITION_FAILED")
    expect(
      unknownErrorMessage(caught, { includeConvexError: true })
    ).not.toContain(invalidSecret)
  })

  test("rejects when wca2fa feature is disabled", async () => {
    const organisation = await import("@/config/lib/organisation")
    const isFeatureEnabledSpy = vi
      .spyOn(organisation, "isFeatureEnabled")
      .mockImplementation((feature) => feature !== "wca2fa")

    vi.stubEnv(WCA_2FA_SECRET_ENV, VALID_32CHAR_SECRET)
    const t = convexTest(schema, modules)
    const userId = await t.run(async (ctx) => {
      const id = await insertTestUser(ctx, "Competitions")
      await addUserToTeam(ctx, id, TEAM_NAMES.COMPETITIONS)
      return id
    })

    await expect(
      t
        .withIdentity({ subject: userId })
        .action(api.plugins.wca.twoFactor.generateCode, {})
    ).rejects.toMatchObject({
      data: {
        code: "PRECONDITION_FAILED",
        message: "WCA 2FA is not enabled for this organisation.",
      },
    })

    isFeatureEnabledSpy.mockRestore()
  })

  test("forbidden for users without Wca2fa access", async () => {
    vi.stubEnv(WCA_2FA_SECRET_ENV, VALID_32CHAR_SECRET)
    const t = convexTest(schema, modules)
    const financeId = await t.run(async (ctx) => {
      const id = await insertTestUser(ctx, "Finance")
      await addUserToTeam(ctx, id, TEAM_NAMES.FINANCE)
      return id
    })

    await expect(
      t
        .withIdentity({ subject: financeId })
        .action(api.plugins.wca.twoFactor.generateCode, {})
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    })
  })

  test("delegates and directors can generate codes", async () => {
    vi.stubEnv(WCA_2FA_SECRET_ENV, VALID_32CHAR_SECRET)
    const t = convexTest(schema, modules)
    const { delegateId, directorId } = await t.run(async (ctx) => {
      const delegateId = await insertTestUser(ctx, "Delegate")
      const directorId = await insertTestUser(ctx, "Director")
      await addUserToTeam(ctx, delegateId, TEAM_NAMES.DELEGATES)
      await addUserToTeam(ctx, directorId, TEAM_NAMES.DIRECTORS)
      return { delegateId, directorId }
    })

    for (const userId of [delegateId, directorId]) {
      const result = await t
        .withIdentity({ subject: userId })
        .action(api.plugins.wca.twoFactor.generateCode, {})
      expect(result.code).toMatch(/^\d{6}$/)
    }
  })
})

function permissionKey(permission: { action: string; subject: string }) {
  return `${permission.action}:${permission.subject}`
}

describe("wca2fa permissions", () => {
  test("current permissions include Wca2fa for delegates and competitions", async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
      const directorId = await insertTestUser(ctx, "Director")
      const delegateId = await insertTestUser(ctx, "Delegate")
      const competitionTeamId = await insertTestUser(ctx, "Competition Team")
      const financeId = await insertTestUser(ctx, "Finance")

      await addUserToTeam(ctx, directorId, TEAM_NAMES.DIRECTORS)
      await addUserToTeam(ctx, delegateId, TEAM_NAMES.DELEGATES)
      await addUserToTeam(ctx, competitionTeamId, TEAM_NAMES.COMPETITIONS)
      await addUserToTeam(ctx, financeId, TEAM_NAMES.FINANCE)

      return { directorId, delegateId, competitionTeamId, financeId }
    })

    const [director, delegate, competitions, finance] = await Promise.all([
      t
        .withIdentity({ subject: ids.directorId })
        .query(api.permissions.queries.currentPermissions, {}),
      t
        .withIdentity({ subject: ids.delegateId })
        .query(api.permissions.queries.currentPermissions, {}),
      t
        .withIdentity({ subject: ids.competitionTeamId })
        .query(api.permissions.queries.currentPermissions, {}),
      t
        .withIdentity({ subject: ids.financeId })
        .query(api.permissions.queries.currentPermissions, {}),
    ])

    const hasWca2fa = (permissions: { action: string; subject: string }[]) =>
      permissions.some(
        (permission) =>
          permission.action === "access" && permission.subject === "Wca2fa"
      )

    expect(director.permissions.map(permissionKey)).toEqual(
      expect.arrayContaining(["manage:all"])
    )
    expect(hasWca2fa(delegate.permissions)).toBe(true)
    expect(hasWca2fa(competitions.permissions)).toBe(true)
    expect(hasWca2fa(finance.permissions)).toBe(false)
  })
})
