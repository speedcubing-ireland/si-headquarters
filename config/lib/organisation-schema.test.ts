import { describe, expect, expectTypeOf, test } from "vitest"
import {
  defineOrganisationConfig,
  organisationConfigSchema,
} from "./organisation-schema"
import organisationConfig from "../organisation-config"

function cloneConfig() {
  return organisationConfigSchema.parse(structuredClone(organisationConfig))
}

describe("organisation configuration", () => {
  test("accepts the default organisation manifest", () => {
    expect(organisationConfigSchema.parse(organisationConfig)).toEqual(
      organisationConfig
    )
  })

  test("keeps configured provider ids as literal types", () => {
    type ConfiguredProviderId =
      (typeof organisationConfig.auth.providers)[number]["id"]

    expectTypeOf<ConfiguredProviderId>().toEqualTypeOf<"wca-staff">()
  })

  test("accepts a minimal feature set", () => {
    const config = cloneConfig()
    config.features = {
      google: false,
      canva: false,
      discord: false,
      sponsors: false,
      socialMedia: false,
      wcaIntegration: false,
      wca2fa: false,
      organiserInvites: false,
    }
    config.auth.providers = config.auth.providers.filter(
      (provider) => provider.audience === "staff"
    )
    expect(() => defineOrganisationConfig(config)).not.toThrow()
  })

  test("rejects duplicate providers", () => {
    const config = cloneConfig()
    const providers = config.auth.providers
    config.auth.providers = [...providers, ...providers]
    expect(() => defineOrganisationConfig(config)).toThrow(
      /Duplicate login provider/
    )
  })

  test("rejects unknown features", () => {
    const config = cloneConfig()
    const result = organisationConfigSchema.safeParse({
      ...config,
      features: { ...config.features, timeTravel: true },
    })
    expect(result.success).toBe(false)
  })

  test("requires WCA login when organiser invites are enabled", () => {
    const config = cloneConfig()
    config.features = { ...config.features, organiserInvites: true }
    config.auth.providers = config.auth.providers.filter(
      (provider) => provider.id !== "wca"
    )
    expect(() => defineOrganisationConfig(config)).toThrow(/require the WCA/)
  })

  test("requires WCA integration when organiser invites are enabled", () => {
    const config = cloneConfig()
    config.features = {
      ...config.features,
      organiserInvites: true,
      wcaIntegration: false,
    }
    expect(() => defineOrganisationConfig(config)).toThrow(
      /require WCA integration/
    )
  })

  test("requires sponsorship config when sponsors are enabled", () => {
    const config = cloneConfig()
    config.features = { ...config.features, sponsors: true }
    delete config.sponsorship
    delete config.contacts.sponsorshipTeamEmail
    delete config.contacts.sponsorshipTeamName
    expect(() => defineOrganisationConfig(config)).toThrow(
      /require sponsorship configuration/
    )
  })

  test("rejects sponsor config missing required fields at the type level", () => {
    const invalid = {
      organisation: { name: "X", productName: "X" },
      branding: { notificationFooterText: "X", faviconPath: "/f.png" },
      regional: {
        locale: "en-GB",
        timeZone: "Europe/London",
        timeZoneLabel: "London",
        reminderHour: 8,
      },
      contacts: {},
      features: {
        google: false,
        canva: false,
        discord: false,
        sponsors: true,
        socialMedia: false,
        wcaIntegration: true,
        wca2fa: false,
        organiserInvites: false,
      },
      auth: {
        providers: [{ id: "wca-staff", audience: "staff", label: "X" }],
      },
    } as const

    expect(() =>
      // @ts-expect-error sponsors:true requires sponsorship + contacts fields
      defineOrganisationConfig(invalid)
    ).toThrow(/require sponsorship configuration/)
  })

  test("requires check-in sheet config when Google and WCA integration are enabled", () => {
    const config = cloneConfig()
    config.features = {
      ...config.features,
      google: true,
      wcaIntegration: true,
    }
    delete config.wca
    delete config.contacts.checkinShareEmail
    expect(() => defineOrganisationConfig(config)).toThrow(
      /require WCA configuration/
    )
  })

  test("allows omitting sponsor and check-in config when features are disabled", () => {
    expect(() =>
      defineOrganisationConfig({
        organisation: { name: "UKCA", productName: "UKCA Panel" },
        branding: {
          notificationFooterText: "UKCA Panel",
          faviconPath: "/favicon.png",
        },
        regional: {
          locale: "en-GB",
          timeZone: "Europe/London",
          timeZoneLabel: "London",
          reminderHour: 8,
        },
        contacts: {},
        features: {
          google: false,
          canva: false,
          discord: false,
          sponsors: false,
          socialMedia: false,
          wcaIntegration: true,
          wca2fa: false,
          organiserInvites: false,
        },
        auth: {
          providers: [
            {
              id: "wca-staff",
              audience: "staff",
              label: "UKCA Volunteer (WCA)",
            },
          ],
        },
      })
    ).not.toThrow()
  })

  test("accepts wca-staff: 'staff' as the sole provider", () => {
    expect(() =>
      defineOrganisationConfig({
        organisation: { name: "Test Org", productName: "Test Product" },
        branding: {
          notificationFooterText: "Test Product",
          faviconPath: "/favicon.png",
        },
        regional: {
          locale: "en-GB",
          timeZone: "Europe/London",
          timeZoneLabel: "London",
          reminderHour: 8,
        },
        contacts: {
          checkinShareEmail: "checkin@example.com",
          sponsorshipTeamEmail: "sponsor@example.com",
          sponsorshipTeamName: "Sponsor Team",
        },
        sponsorship: {
          portalName: "Test Sponsor Portal",
          productionHost: "sponsors.example.com",
          defaultCurrency: "GBP",
        },
        wca: {
          scheduleTemplateCompetitionId: "TestTemplate2100",
        },
        features: {
          google: false,
          canva: false,
          discord: false,
          sponsors: false,
          socialMedia: false,
          wcaIntegration: false,
          wca2fa: false,
          organiserInvites: false,
        },
        auth: {
          providers: [
            { id: "wca-staff", audience: "staff", label: "WCA Staff" },
          ],
        },
      })
    ).not.toThrow()
  })
})
