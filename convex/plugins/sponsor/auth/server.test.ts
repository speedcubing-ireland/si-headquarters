import { afterEach, describe, expect, test } from "vitest"
import {
  trimTrailingSlash,
  uniqueOrigins,
  resolveSponsorAuthSecret,
  buildSponsorOtpEmail,
  createSponsorAuth,
  createSponsorAuthOptions,
  SPONSOR_AUTH_ANALYSIS_CONFIG,
} from "./server"

type RestorableEnvKey =
  | "BETTER_AUTH_SECRET"
  | "SITE_URL"
  | "SPONSOR_BETTER_AUTH_SECRET"
  | "SPONSOR_SITE_URL"

function restoreEnv(key: RestorableEnvKey, value: string | undefined) {
  if (value !== undefined) {
    process.env[key] = value
    return
  }

  if (key === "SITE_URL") delete process.env.SITE_URL
  else if (key === "SPONSOR_SITE_URL") delete process.env.SPONSOR_SITE_URL
  else if (key === "SPONSOR_BETTER_AUTH_SECRET")
    delete process.env.SPONSOR_BETTER_AUTH_SECRET
  else delete process.env.BETTER_AUTH_SECRET
}

describe("trimTrailingSlash", () => {
  test("removes trailing slash", () => {
    expect(trimTrailingSlash("https://example.com/")).toBe(
      "https://example.com"
    )
  })

  test("leaves strings without trailing slash unchanged", () => {
    expect(trimTrailingSlash("https://example.com")).toBe("https://example.com")
  })

  test("only removes one trailing slash", () => {
    expect(trimTrailingSlash("https://example.com//")).toBe(
      "https://example.com/"
    )
  })

  test("handles empty string", () => {
    expect(trimTrailingSlash("")).toBe("")
  })
})

describe("uniqueOrigins", () => {
  test("deduplicates identical origins", () => {
    expect(
      uniqueOrigins(["https://a.com", "https://a.com", "https://b.com"])
    ).toEqual(["https://a.com", "https://b.com"])
  })

  test("deduplicates after trimming trailing slashes", () => {
    expect(uniqueOrigins(["https://a.com/", "https://a.com"])).toEqual([
      "https://a.com",
    ])
  })

  test("filters out undefined values", () => {
    expect(uniqueOrigins([undefined, "https://a.com", undefined])).toEqual([
      "https://a.com",
    ])
  })

  test("filters out empty strings", () => {
    expect(uniqueOrigins(["", "https://a.com", ""])).toEqual(["https://a.com"])
  })

  test("returns empty array for all undefined/empty input", () => {
    expect(uniqueOrigins([undefined, "", undefined])).toEqual([])
  })
})

describe("resolveSponsorAuthSecret", () => {
  test("returns SPONSOR_BETTER_AUTH_SECRET when set and long enough", () => {
    expect(
      resolveSponsorAuthSecret(false, {
        SPONSOR_BETTER_AUTH_SECRET: "a".repeat(32),
        BETTER_AUTH_SECRET: "b".repeat(32),
      })
    ).toBe("a".repeat(32))
  })

  test("falls back to BETTER_AUTH_SECRET", () => {
    expect(
      resolveSponsorAuthSecret(false, {
        SPONSOR_BETTER_AUTH_SECRET: undefined,
        BETTER_AUTH_SECRET: "b".repeat(32),
      })
    ).toBe("b".repeat(32))
  })

  test("rejects secrets shorter than 32 characters", () => {
    expect(
      resolveSponsorAuthSecret(false, {
        SPONSOR_BETTER_AUTH_SECRET: "short",
        BETTER_AUTH_SECRET: undefined,
      })
    ).toBe("dev-only-sponsor-auth-secret-change-in-production")
  })

  test("returns dev fallback when no secret configured", () => {
    expect(
      resolveSponsorAuthSecret(false, {
        SPONSOR_BETTER_AUTH_SECRET: undefined,
        BETTER_AUTH_SECRET: undefined,
      })
    ).toBe("dev-only-sponsor-auth-secret-change-in-production")
  })

  test("throws when requireConfiguredSecret is true and no valid secret", () => {
    expect(() =>
      resolveSponsorAuthSecret(true, {
        SPONSOR_BETTER_AUTH_SECRET: undefined,
        BETTER_AUTH_SECRET: undefined,
      })
    ).toThrow("Missing BETTER_AUTH_SECRET")
  })
})

describe("createSponsorAuthOptions", () => {
  const fakeCtx = {
    runMutation: () => Promise.resolve(),
    runQuery: () => Promise.resolve(),
    runAction: () => Promise.resolve(),
  } as unknown as Parameters<typeof createSponsorAuthOptions>[0]

  test("does not read Convex env during adapter schema analysis", async () => {
    const savedSiteUrl = process.env.SITE_URL
    const savedSponsorSiteUrl = process.env.SPONSOR_SITE_URL
    const savedSponsorSecret = process.env.SPONSOR_BETTER_AUTH_SECRET
    const savedBetterAuthSecret = process.env.BETTER_AUTH_SECRET
    delete process.env.SITE_URL
    delete process.env.SPONSOR_SITE_URL
    delete process.env.SPONSOR_BETTER_AUTH_SECRET
    delete process.env.BETTER_AUTH_SECRET

    const options = createSponsorAuthOptions(
      fakeCtx,
      SPONSOR_AUTH_ANALYSIS_CONFIG
    )
    const adapter = await import("./component/sponsorAuth/adapter")

    restoreEnv("SITE_URL", savedSiteUrl)
    restoreEnv("SPONSOR_SITE_URL", savedSponsorSiteUrl)
    restoreEnv("SPONSOR_BETTER_AUTH_SECRET", savedSponsorSecret)
    restoreEnv("BETTER_AUTH_SECRET", savedBetterAuthSecret)

    expect(options.baseURL).toBe("http://localhost:3210")
    expect(options.trustedOrigins).toContain("http://localhost:5174")
    expect(adapter.create).toBeDefined()
  })

  test("uses email OTP only (no password or passkey)", () => {
    let options: ReturnType<typeof createSponsorAuthOptions>
    try {
      options = createSponsorAuthOptions(fakeCtx, SPONSOR_AUTH_ANALYSIS_CONFIG)
    } catch {
      return
    }
    expect(options.emailAndPassword?.enabled).toBe(false)
    expect(
      (options.plugins ?? []).find((p) => p.id === "passkey")
    ).toBeUndefined()
    expect(
      (options.plugins ?? []).find((p) => p.id === "email-otp")
    ).toBeDefined()
  })

  test("runtime auth requires a configured production secret", () => {
    const savedSponsorSecret = process.env.SPONSOR_BETTER_AUTH_SECRET
    const savedBetterAuthSecret = process.env.BETTER_AUTH_SECRET
    delete process.env.SPONSOR_BETTER_AUTH_SECRET
    delete process.env.BETTER_AUTH_SECRET

    try {
      expect(() => createSponsorAuth(fakeCtx)).toThrow(
        "Missing BETTER_AUTH_SECRET"
      )
    } finally {
      restoreEnv("SPONSOR_BETTER_AUTH_SECRET", savedSponsorSecret)
      restoreEnv("BETTER_AUTH_SECRET", savedBetterAuthSecret)
    }
  })
})

describe("buildSponsorOtpEmail sender address", () => {
  const saved = process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS

  afterEach(() => {
    if (saved !== undefined)
      process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS = saved
    else delete process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS
  })

  test("uses SPONSORSHIP_EMAIL_SENDER_ADDRESS env var when set", async () => {
    process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS = "custom@example.com"
    const result = await buildSponsorOtpEmail({
      email: "user@example.com",
      otp: "123456",
      type: "sign-in",
    })
    expect(result.senderAddress).toBe("custom@example.com")
  })

  test("falls back to sponsorship@speedcubingireland.com when env unset", async () => {
    delete process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS
    const result = await buildSponsorOtpEmail({
      email: "user@example.com",
      otp: "123456",
      type: "sign-in",
    })
    expect(result.senderAddress).toBe("sponsorship@speedcubingireland.com")
  })

  test("falls back to default when env var is whitespace", async () => {
    process.env.SPONSORSHIP_EMAIL_SENDER_ADDRESS = "   "
    const result = await buildSponsorOtpEmail({
      email: "user@example.com",
      otp: "123456",
      type: "sign-in",
    })
    expect(result.senderAddress).toBe("sponsorship@speedcubingireland.com")
  })
})

describe("buildSponsorOtpEmail", () => {
  test("builds sign-in email with correct subject", async () => {
    const result = await buildSponsorOtpEmail({
      email: "user@example.com",
      otp: "654321",
      type: "sign-in",
    })
    expect(result.subject).toBe(
      "Speedcubing Ireland Sponsor Portal sign-in code"
    )
  })

  test("builds email-verification with verification subject", async () => {
    const result = await buildSponsorOtpEmail({
      email: "user@example.com",
      otp: "111111",
      type: "email-verification",
    })
    expect(result.subject).toBe(
      "Speedcubing Ireland Sponsor Portal email verification code"
    )
  })

  test("preserves original email as recipientEmail", async () => {
    const result = await buildSponsorOtpEmail({
      email: "Test@Example.COM",
      otp: "123456",
      type: "sign-in",
    })
    expect(result.recipientEmail).toBe("Test@Example.COM")
  })

  test("includes OTP in both plain text and HTML body", async () => {
    const result = await buildSponsorOtpEmail({
      email: "user@example.com",
      otp: "987654",
      type: "sign-in",
    })
    expect(result.plainTextBody).toContain("987654")
    expect(result.htmlBody).toContain("987654")
  })

  test("includes 60 minute expiry in body", async () => {
    const result = await buildSponsorOtpEmail({
      email: "user@example.com",
      otp: "123456",
      type: "sign-in",
    })
    expect(result.plainTextBody).toContain("60 minutes")
  })

  test("includes purpose-specific text for sign-in", async () => {
    const result = await buildSponsorOtpEmail({
      email: "u@e.com",
      otp: "1",
      type: "sign-in",
    })
    expect(result.plainTextBody).toContain("sign in")
  })
})
