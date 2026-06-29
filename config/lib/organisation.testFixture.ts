import { createOrganisationAccessors } from "./organisation-accessors"
import {
  defineOrganisationConfig,
  type OrganisationConfigDefinition,
} from "./organisation-schema"

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
    wca2fa: true,
    organiserInvites: true,
    refunds: true,
    events: true,
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

export const {
  isFeatureEnabled,
  findLoginProvider,
  sponsorshipConfig,
  configuredSponsorshipSenderAddress,
  checkinSheetsConfig,
} = createOrganisationAccessors(config)

export type {
  FeatureId,
  LoginProviderConfig,
  OrganisationConfig,
} from "./organisation-schema"
