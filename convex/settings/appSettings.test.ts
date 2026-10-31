/// <reference types="vite/client" />
import type { EmailId } from "@convex-dev/resend"
import { convexTest, type TestConvex } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"
import { api, internal } from "@/convex/_generated/api"
import schema from "@/convex/schema"
import { modules } from "@/convex/test.setup"
import { resend } from "@/convex/sendEmails"
import { seedDirectorUser, seedVolunteerTestUser } from "@/convex/testHelpers"
import { sponsorshipConfig } from "@/config/lib/organisation"

async function asDirector(t: TestConvex<typeof schema>) {
  const userId = await t.run(async (ctx) => seedDirectorUser(ctx))
  return t.withIdentity({ subject: userId })
}

async function asVolunteer(t: TestConvex<typeof schema>) {
  const userId = await t.run(async (ctx) => seedVolunteerTestUser(ctx))
  return t.withIdentity({ subject: userId })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("get", () => {
  test("reports nothing configured on a fresh deployment", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    expect(await director.query(api.settings.appSettings.get, {})).toEqual({
      canva: { certificates: null, lanyards: null, updatedAt: null },
      recordsEmail: { recipients: [], senderAddress: null, updatedAt: null },
      sponsorshipEmail: {
        senderAddress: null,
        defaultSenderAddress: sponsorshipConfig().contacts.sponsorshipTeamEmail,
        updatedAt: null,
      },
      achievements: { siteUrl: null, updatedAt: null },
    })
  })

  test("is directors only, as are the updates", async () => {
    const t = convexTest(schema, modules)
    const volunteer = await asVolunteer(t)

    await expect(
      volunteer.query(api.settings.appSettings.get, {})
    ).rejects.toThrow(/Directors only/)
    await expect(
      volunteer.mutation(api.settings.appSettings.updateAchievements, {
        siteUrl: "https://achievements.example.com",
      })
    ).rejects.toThrow(/Directors only/)
  })
})

describe("updateRecordsEmail", () => {
  test("stores trimmed, deduplicated recipients and the sender", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await director.mutation(api.settings.appSettings.updateRecordsEmail, {
      recipients: [
        "social@example.com, design@example.com",
        "social@example.com",
      ],
      senderAddress: "  HQ   <noreply@example.com> ",
    })

    const settings = await director.query(api.settings.appSettings.get, {})
    expect(settings.recordsEmail).toMatchObject({
      recipients: ["social@example.com", "design@example.com"],
      senderAddress: "HQ <noreply@example.com>",
    })
    expect(settings.recordsEmail.updatedAt).toBeTypeOf("number")
  })

  test.each([
    [{ recipients: [], senderAddress: "hq@example.com" }, /at least one/],
    [
      { recipients: ["not-an-email"], senderAddress: "hq@example.com" },
      /not an email/,
    ],
    [
      { recipients: ["a@example.com"], senderAddress: "HQ <nope>" },
      /must be an email/,
    ],
  ])("rejects %j", async (args, message) => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await expect(
      director.mutation(api.settings.appSettings.updateRecordsEmail, args)
    ).rejects.toThrow(message)
  })
})

describe("updateCanva", () => {
  test("stores each preset's pair, and clearing both drops the row", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await director.mutation(api.settings.appSettings.updateCanva, {
      certificates: {
        brandTemplateId: " tpl-cert ",
        outputFolderId: "fld-cert",
      },
      lanyards: null,
    })
    expect(
      await t.query(internal.settings.appSettings.getCanvaPresetSettings, {
        presetKey: "certificates",
      })
    ).toEqual({ brandTemplateId: "tpl-cert", outputFolderId: "fld-cert" })
    expect(
      await t.query(internal.settings.appSettings.getCanvaPresetSettings, {
        presetKey: "lanyards",
      })
    ).toBeNull()

    await director.mutation(api.settings.appSettings.updateCanva, {
      certificates: null,
      lanyards: null,
    })
    expect(
      await t.run(async (ctx) => ctx.db.query("appSettings").take(10))
    ).toEqual([])
  })

  test("rejects a template without its folder", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await expect(
      director.mutation(api.settings.appSettings.updateCanva, {
        certificates: null,
        lanyards: { brandTemplateId: "tpl", outputFolderId: " " },
      })
    ).rejects.toThrow(/Lanyards needs both/)
  })
})

describe("updateAchievements", () => {
  test("trims trailing slashes, rejects non-http URLs, and null clears", async () => {
    const t = convexTest(schema, modules)
    const director = await asDirector(t)

    await director.mutation(api.settings.appSettings.updateAchievements, {
      siteUrl: "https://achievements.example.com//",
    })
    expect(
      (await director.query(api.settings.appSettings.get, {})).achievements
        .siteUrl
    ).toBe("https://achievements.example.com")

    await expect(
      director.mutation(api.settings.appSettings.updateAchievements, {
        siteUrl: "ftp://achievements.example.com",
      })
    ).rejects.toThrow(/https:\/\/ or http:\/\//)

    await director.mutation(api.settings.appSettings.updateAchievements, {
      siteUrl: null,
    })
    expect(
      (await director.query(api.settings.appSettings.get, {})).achievements
        .siteUrl
    ).toBeNull()
  })
})

describe("sponsorship sender", () => {
  test("sends from the override, or the manifest address once it is cleared", async () => {
    const sendEmail = vi
      .spyOn(resend, "sendEmail")
      .mockResolvedValue("email-1" as EmailId)
    const t = convexTest(schema, modules)
    const director = await asDirector(t)
    const email = {
      to: "sponsor@example.com",
      subject: "Hello",
      text: "Hello",
    }

    await director.mutation(api.settings.appSettings.updateSponsorshipEmail, {
      senderAddress: "Sponsorship <sponsors@example.com>",
    })
    await t.mutation(
      internal.plugins.sponsor.emails.send.deliverSponsorshipEmail,
      email
    )
    await director.mutation(api.settings.appSettings.updateSponsorshipEmail, {
      senderAddress: null,
    })
    await t.mutation(
      internal.plugins.sponsor.emails.send.deliverSponsorshipEmail,
      email
    )

    expect(
      sendEmail.mock.calls.map((call) => {
        const options: unknown = call[1]
        return typeof options === "object" &&
          options !== null &&
          "from" in options
          ? options.from
          : null
      })
    ).toEqual([
      "Sponsorship <sponsors@example.com>",
      sponsorshipConfig().contacts.sponsorshipTeamEmail,
    ])
  })
})

describe("importFromEnv", () => {
  test("copies the old env vars into groups that have no row yet", async () => {
    vi.stubEnv("CANVA_CERT_TEMPLATE_ID", "tpl-cert")
    vi.stubEnv("CANVA_CERT_OUTPUT_FOLDER_ID", "fld-cert")
    vi.stubEnv("SOCIAL_MEDIA_RECORDS_EMAIL_TO", "a@example.com, b@example.com")
    vi.stubEnv("SOCIAL_MEDIA_EMAIL_SENDER_ADDRESS", "HQ <hq@example.com>")
    vi.stubEnv("SPONSORSHIP_EMAIL_SENDER_ADDRESS", "")
    vi.stubEnv("ACHIEVEMENTS_SITE_URL", "https://env.example.com")
    const t = convexTest(schema, modules)
    const director = await asDirector(t)
    await director.mutation(api.settings.appSettings.updateAchievements, {
      siteUrl: "https://saved.example.com",
    })

    expect(
      await t.mutation(internal.settings.migrations.importFromEnv, {})
    ).toEqual({
      imported: ["canva", "recordsEmail"],
      skipped: ["sponsorshipEmail", "achievements"],
    })

    const settings = await director.query(api.settings.appSettings.get, {})
    expect(settings.canva.certificates).toEqual({
      brandTemplateId: "tpl-cert",
      outputFolderId: "fld-cert",
    })
    expect(settings.canva.lanyards).toBeNull()
    expect(settings.recordsEmail).toMatchObject({
      recipients: ["a@example.com", "b@example.com"],
      senderAddress: "HQ <hq@example.com>",
    })
    expect(settings.sponsorshipEmail.senderAddress).toBeNull()
    expect(settings.achievements.siteUrl).toBe("https://saved.example.com")
  })
})
