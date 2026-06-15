// @vitest-environment node
import { describe, expect, test } from "vitest"
import { REQUIRED_ENV_KEYS } from "../../convex/envConfig.ts"
import { CANVA_DEFINITION } from "../../convex/plugins/canva/definition.ts"
import { GOOGLE_DEFINITION } from "../../convex/plugins/google/definition.ts"
import { WCA_DEFINITION } from "../../convex/plugins/wca/definition.ts"
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

  test("organiser WCA login credentials are optional", () => {
    const specs = buildWizardEnvSpecs()
    for (const key of ["AUTH_WCA_ID", "AUTH_WCA_SECRET"]) {
      const spec = specs.find((entry) => entry.key === key)
      expect(spec?.optional).toBe(true)
      expect(REQUIRED_ENV_KEYS).not.toContain(key)
      expect(
        spec === undefined ? "missing spec" : validateEnvValue(spec, "")
      ).toBeNull()
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
    expect(output).toContain("[prompt · optional]")
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

    expect(planEnvChanges(specs, existing)).toEqual([
      { key: "AUTH_GOOGLE_ID", action: "skip-existing" },
      { key: "AUTH_GOOGLE_SECRET", action: "set" },
      { key: "CLI_AUTH_TOKEN", action: "skip-existing" },
    ])
    expect(
      planEnvChanges(specs, existing, {
        replaceExistingKeys: new Set(["CLI_AUTH_TOKEN"]),
      })
    ).toEqual([
      { key: "AUTH_GOOGLE_ID", action: "skip-existing" },
      { key: "AUTH_GOOGLE_SECRET", action: "set" },
      { key: "CLI_AUTH_TOKEN", action: "set" },
    ])
    expect(planEnvChanges(specs, existing, { force: true })).toEqual([
      { key: "AUTH_GOOGLE_ID", action: "set" },
      { key: "AUTH_GOOGLE_SECRET", action: "set" },
      { key: "CLI_AUTH_TOKEN", action: "set" },
    ])
  })

  test("omits optional values left blank", () => {
    const specs = buildWizardEnvSpecs().filter((spec) =>
      ["AUTH_WCA_ID", "AUTH_WCA_SECRET"].includes(spec.key)
    )

    expect(
      planEnvChanges(specs, new Set(), {
        providedKeys: new Set(),
      })
    ).toEqual([])
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
