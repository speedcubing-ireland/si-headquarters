// @vitest-environment node
import { describe, expect, test, vi } from "vitest"
import {
  buildRequiredEnvSetup,
  REQUIRED_ENV_KEYS,
} from "../../convex/envConfig.ts"

// Verify env-setup wiring for the full feature/provider set; the shipped
// manifest gates most of it off. (The "omits disabled features" test below
// imports the real manifest directly and is unaffected by this mock.)
vi.mock(
  "@/config/lib/organisation",
  () => import("@/config/lib/organisation.testFixture")
)
import { CANVA_DEFINITION } from "../../convex/plugins/canva/definition.ts"
import { GOOGLE_DEFINITION } from "../../convex/plugins/google/definition.ts"
import { WCA_DEFINITION } from "../../convex/plugins/wca/definition.ts"
import organisationConfig from "../../config/organisation-config.ts"
import { organisationConfigSchema } from "../../config/lib/organisation-schema.ts"
import {
  buildWizardEnvSpecs,
  generateEnvValues,
  parseConvexEnvList,
  planEnvChanges,
  renderDryRunPlan,
  updateDotenvContent,
  validateEnvValue,
} from "./set-convex-env.ts"

describe("set-convex-env metadata", () => {
  test("covers every required Convex setup env key", () => {
    const specKeys = new Set(buildWizardEnvSpecs().map((spec) => spec.key))

    for (const key of REQUIRED_ENV_KEYS) {
      expect(specKeys.has(key), key).toBe(true)
    }
  })

  test("does not duplicate setup keys", () => {
    const specs = buildWizardEnvSpecs()
    const uniqueKeys = new Set(specs.map((spec) => spec.key))

    expect(specs).toHaveLength(uniqueKeys.size)
  })

  test("WCA login credentials are required when a WCA provider is configured", () => {
    const specs = buildWizardEnvSpecs()
    for (const key of ["AUTH_WCA_ID", "AUTH_WCA_SECRET"]) {
      const spec = specs.find((entry) => entry.key === key)
      expect(spec).toBeDefined()
      expect(spec?.optional).not.toBe(true)
      expect(REQUIRED_ENV_KEYS).toContain(key)
      expect(
        spec === undefined ? "missing spec" : validateEnvValue(spec, "")
      ).toBe(`${key} is required.`)
    }
  })

  test("uses dev-friendly defaults for setup choices", () => {
    const specs = buildWizardEnvSpecs()

    expect(
      specs.find((spec) => spec.key === "DEPLOYMENT_CONTEXT")?.defaultValue
    ).toBe("staging")
    expect(
      specs.find((spec) => spec.key === "RESEND_TEST_MODE")?.defaultValue
    ).toBe("true")
    expect(specs.find((spec) => spec.key === "SITE_URL")?.defaultValue).toBe(
      "http://localhost:5173"
    )
    expect(
      specs.find((spec) => spec.key === "SPONSOR_SITE_URL")?.defaultValue
    ).toBe("http://localhost:5174")
  })

  test("service OAuth keys are declared in each service definition", () => {
    for (const definition of [
      CANVA_DEFINITION,
      GOOGLE_DEFINITION,
      WCA_DEFINITION,
    ]) {
      expect(definition.env).toContain(definition.oauth.clientId)
      expect(definition.env).toContain(definition.oauth.clientSecret)
    }
  })

  test("omits setup for disabled features and providers", () => {
    const config = organisationConfigSchema.parse(
      structuredClone(organisationConfig)
    )
    config.features = {
      google: false,
      canva: false,
      discord: false,
      sponsors: false,
      socialMedia: false,
      wcaIntegration: false,
      wca2fa: false,
      organiserInvites: false,
      refunds: false,
      events: false,
    }
    config.auth.providers = config.auth.providers.filter(
      (provider) => provider.id !== "wca" && provider.id !== "wca-staff"
    )
    const keys = buildRequiredEnvSetup(config).map((spec) => spec.key)

    expect(keys.some((key) => key.startsWith("CANVA_"))).toBe(false)
    expect(keys.some((key) => key.startsWith("DISCORD_"))).toBe(false)
    expect(keys.some((key) => key.startsWith("SERVICE_WCA_"))).toBe(false)
    expect(keys).not.toContain("WCA_2FA_SECRET")
    expect(keys).not.toContain("AUTH_WCA_ID")
    expect(keys).not.toContain("SPONSOR_BETTER_AUTH_SECRET")
    expect(keys).not.toContain("SPONSOR_SITE_URL")
    expect(keys).not.toContain("RESEND_API_KEY")
  })

  test("generated wizard entries receive generated values", () => {
    const generated = {
      CLI_AUTH_TOKEN: "cli-token",
      DISCORD_ACTION_SECRET: "discord-secret",
      JWT_PRIVATE_KEY: "private-key",
      JWKS: "jwks",
      SPONSOR_BETTER_AUTH_SECRET: "sponsor-secret",
    }
    const specsByKey = new Map(
      buildWizardEnvSpecs(generated).map((spec) => [spec.key, spec])
    )

    for (const [key, value] of Object.entries(generated)) {
      expect(specsByKey.get(key)?.generatedValue).toBe(value)
    }
  })
})

describe("dry run plan rendering", () => {
  test("lists every variable with description, tags, and a summary", () => {
    const output = renderDryRunPlan(buildWizardEnvSpecs())

    expect(output).toContain("Google OAuth client ID for staff login.")
    expect(output).toContain("default: staging")
    expect(output).toContain("choices: staging, production")
    expect(output).toContain("[generated · secret]")
    expect(output).toMatch(/\d+ variables · \d+ prompted · \d+ generated/)
    expect(output).not.toMatch(/-----BEGIN PRIVATE KEY-----/)
  })
})

describe("Convex env planning", () => {
  test("parses keys from convex env list output without retaining values", () => {
    const keys = parseConvexEnvList(
      [
        "AUTH_GOOGLE_ID=client-id",
        "JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY----- secret",
        "",
      ].join("\n")
    )

    expect(keys).toEqual(new Set(["AUTH_GOOGLE_ID", "JWT_PRIVATE_KEY"]))
  })

  test("keeps existing keys unless forced or explicitly replaced", () => {
    const specs = buildWizardEnvSpecs().filter((spec) =>
      ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "CLI_AUTH_TOKEN"].includes(
        spec.key
      )
    )
    const existing = new Set(["AUTH_GOOGLE_ID", "CLI_AUTH_TOKEN"])

    // Compare by key rather than position: planEnvChanges preserves the env
    // setup ordering, which this test does not care about.
    const actionByKey = (
      ...args: Parameters<typeof planEnvChanges>
    ): Record<string, string> =>
      Object.fromEntries(planEnvChanges(...args).map((p) => [p.key, p.action]))

    expect(actionByKey(specs, existing)).toEqual({
      AUTH_GOOGLE_ID: "skip-existing",
      AUTH_GOOGLE_SECRET: "set",
      CLI_AUTH_TOKEN: "skip-existing",
    })
    expect(
      actionByKey(specs, existing, {
        replaceExistingKeys: new Set(["CLI_AUTH_TOKEN"]),
      })
    ).toEqual({
      AUTH_GOOGLE_ID: "skip-existing",
      AUTH_GOOGLE_SECRET: "set",
      CLI_AUTH_TOKEN: "set",
    })
    expect(actionByKey(specs, existing, { force: true })).toEqual({
      AUTH_GOOGLE_ID: "set",
      AUTH_GOOGLE_SECRET: "set",
      CLI_AUTH_TOKEN: "set",
    })
  })

  test("plans required WCA credentials even when not pre-provided", () => {
    const specs = buildWizardEnvSpecs().filter((spec) =>
      ["AUTH_WCA_ID", "AUTH_WCA_SECRET"].includes(spec.key)
    )

    expect(
      planEnvChanges(specs, new Set(), {
        providedKeys: new Set(),
      })
    ).toEqual([
      { key: "AUTH_WCA_ID", action: "set" },
      { key: "AUTH_WCA_SECRET", action: "set" },
    ])
  })
})

describe(".env.local updates", () => {
  test("appends CLI_AUTH_TOKEN to empty content", () => {
    expect(updateDotenvContent("", "CLI_AUTH_TOKEN", "abc")).toBe(
      "CLI_AUTH_TOKEN=abc\n"
    )
  })

  test("replaces existing CLI_AUTH_TOKEN without disturbing other values", () => {
    expect(
      updateDotenvContent(
        "OTHER=value\nCLI_AUTH_TOKEN=old\n",
        "CLI_AUTH_TOKEN",
        "new"
      )
    ).toBe("OTHER=value\nCLI_AUTH_TOKEN=new\n")
  })

  test("adds a newline before appending when needed", () => {
    expect(updateDotenvContent("OTHER=value", "CLI_AUTH_TOKEN", "abc")).toBe(
      "OTHER=value\nCLI_AUTH_TOKEN=abc\n"
    )
  })
})

describe("generated secrets", () => {
  test("generates Convex Auth keys and random app secrets", async () => {
    const generated = await generateEnvValues()
    const jwks: {
      keys: { use?: string; kty?: string; n?: string; e?: string }[]
    } = JSON.parse(generated.JWKS)

    expect(generated.CLI_AUTH_TOKEN).toMatch(/^[a-f0-9]{64}$/)
    expect(generated.DISCORD_ACTION_SECRET.length).toBeGreaterThanOrEqual(40)
    expect(generated.SPONSOR_BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(
      40
    )
    expect(generated.JWT_PRIVATE_KEY).toMatch(
      /^-----BEGIN PRIVATE KEY----- .+ -----END PRIVATE KEY-----$/
    )
    expect(jwks.keys).toHaveLength(1)
    expect(jwks.keys[0]).toMatchObject({ use: "sig", kty: "RSA", e: "AQAB" })
    expect(jwks.keys[0]?.n).toEqual(expect.any(String))
  })
})
