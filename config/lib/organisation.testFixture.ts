import { organisationConfigSchema } from "./organisation-schema"
import type { FeatureId, LoginProviderConfig } from "./organisation-schema"

// All-features-enabled manifest for tests that verify cross-feature catalog
// integrity — plugin registries, env setup, and task integrations. The
// production manifest in organisation-config.ts intentionally disables most
// features, so tests that assert the full catalog mock "@/config/lib/organisation"
// with this fixture instead of coupling to whichever features a given fork ships.
const config = organisationConfigSchema.parse({
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
    google: true,
    canva: true,
    discord: true,
    sponsors: true,
    socialMedia: true,
    wcaIntegration: true,
    organiserInvites: true,
  },
  auth: {
    providers: [
      {
        id: "google",
        audience: "staff",
        label: "Google",
        hostedDomain: "example.com",
      },
      { id: "wca-staff", audience: "staff", label: "WCA Staff" },
      { id: "wca", audience: "organiser", label: "WCA" },
    ],
  },
})

export const organisationConfig = config

export function isFeatureEnabled(feature: FeatureId): boolean {
  return config.features[feature]
}

export function loginProvider<Id extends LoginProviderConfig["id"]>(
  id: Id
): Extract<LoginProviderConfig, { id: Id }> | undefined {
  return config.auth.providers.find(
    (provider): provider is Extract<LoginProviderConfig, { id: Id }> =>
      provider.id === id
  )
}

export function configuredSponsorshipSenderAddress(): string {
  return `${config.contacts.sponsorshipTeamName} <${config.contacts.sponsorshipTeamEmail}>`
}
