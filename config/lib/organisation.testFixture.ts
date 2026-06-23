import {
  defineOrganisationConfig,
  type OrganisationConfig,
  type OrganisationConfigDefinition,
} from "./organisation-schema"
import type { FeatureId, LoginProviderConfig } from "./organisation-schema"

// All-features-enabled manifest for tests that verify cross-feature catalog
// integrity — plugin registries, env setup, and task integrations. The
// production manifest in organisation-config.ts intentionally disables most
// features, so tests that assert the full catalog mock "@/config/lib/organisation"
// with this fixture instead of coupling to whichever features a given fork ships.
const config = defineOrganisationConfig({
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
} as const satisfies OrganisationConfigDefinition)

export const organisationConfig = config

export function isFeatureEnabled(feature: FeatureId): boolean {
  return config.features[feature]
}

type ConfiguredProvider = (typeof config.auth.providers)[number]
type ConfiguredProviderId = ConfiguredProvider["id"]

export function loginProvider(
  id: ConfiguredProviderId
): ConfiguredProvider | undefined {
  return config.auth.providers.find((provider) => provider.id === id)
}

export function findLoginProvider(
  id: LoginProviderConfig["id"]
): LoginProviderConfig | undefined {
  return config.auth.providers.find((provider) => provider.id === id)
}

type SponsorshipEnabledConfig = OrganisationConfigDefinition & {
  contacts: OrganisationConfig["contacts"] & {
    sponsorshipTeamEmail: string
    sponsorshipTeamName: string
  }
  sponsorship: NonNullable<OrganisationConfig["sponsorship"]>
}

function assertSponsorshipEnabled(
  organisation: OrganisationConfigDefinition
): asserts organisation is SponsorshipEnabledConfig {
  if (!organisation.features.sponsors) {
    throw new Error(
      "Sponsorship config was requested while sponsors are disabled."
    )
  }

  const { sponsorshipTeamEmail, sponsorshipTeamName } = organisation.contacts
  if (
    sponsorshipTeamEmail === undefined ||
    sponsorshipTeamName === undefined ||
    organisation.sponsorship === undefined
  ) {
    throw new Error("Sponsorship config is incomplete.")
  }
}

export function sponsorshipConfig(): SponsorshipEnabledConfig {
  assertSponsorshipEnabled(config)
  return config
}

export function configuredSponsorshipSenderAddress(): string {
  const sponsorship = sponsorshipConfig()

  return `${sponsorship.contacts.sponsorshipTeamName} <${sponsorship.contacts.sponsorshipTeamEmail}>`
}

type CheckinSheetsEnabledConfig = OrganisationConfigDefinition & {
  contacts: OrganisationConfig["contacts"] & {
    checkinShareEmail: string
  }
  wca: NonNullable<OrganisationConfig["wca"]>
}

function assertCheckinSheetsEnabled(
  organisation: OrganisationConfigDefinition
): asserts organisation is CheckinSheetsEnabledConfig {
  if (!organisation.features.google || !organisation.features.wcaIntegration) {
    throw new Error(
      "Check-in sheets config was requested while Google or WCA integration is disabled."
    )
  }

  if (
    organisation.contacts.checkinShareEmail === undefined ||
    organisation.wca === undefined
  ) {
    throw new Error("Check-in sheets config is incomplete.")
  }
}

export function checkinSheetsConfig(): CheckinSheetsEnabledConfig {
  assertCheckinSheetsEnabled(config)
  return config
}
