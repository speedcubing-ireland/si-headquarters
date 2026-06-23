import { defineOrganisationConfig } from "./lib/organisation-schema"

// This non-secret manifest is the only file an organisation fork should need to
// edit. OAuth secrets and API credentials remain in the deployment environment.
export default defineOrganisationConfig({
  organisation: {
    name: "UK Cube Association",
    productName: "Sponsor Panel",
  },
  branding: {
    notificationFooterText: "UKCA Sponsor Panel",
    faviconPath: "/favicon.png",
  },
  regional: {
    locale: "en-GB",
    timeZone: "Europe/London",
    timeZoneLabel: "London",
    reminderHour: 8,
  },
  contacts: {
    sponsorshipTeamEmail: "sponsorship@ukca.org",
    sponsorshipTeamName: "UKCA Sponsorship Team",
  },
  sponsorship: {
    portalName: "UKCA Sponsor Portal",
    productionHost: "sponsors.ukca.org",
    defaultCurrency: "GBP",
  },
  features: {
    google: false,
    canva: false,
    discord: false,
    sponsors: false,
    socialMedia: false,
    wcaIntegration: true,
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
