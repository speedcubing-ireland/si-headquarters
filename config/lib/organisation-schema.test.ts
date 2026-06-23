import { describe, expect, test } from "vitest"
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

  test("accepts a minimal feature set", () => {
    const config = cloneConfig()
    config.features = {
      google: false,
      canva: false,
      discord: false,
      sponsors: false,
      socialMedia: false,
      wcaIntegration: false,
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
