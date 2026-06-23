import {
  defineOrganisationConfig,
  type OrganisationConfigDefinition,
} from "./lib/organisation-schema"

// This non-secret manifest is the only file an organisation fork should need to
// edit. OAuth secrets and API credentials remain in the deployment environment.
const organisationConfig = {
  organisation: {
    name: "Speedcubing Ireland",
    productName: "Headquarters",
  },
  branding: {
    notificationFooterText: "SI Headquarters",
    faviconPath: "/favicon.png",
  },
  regional: {
    locale: "en-IE",
    timeZone: "Europe/Dublin",
    timeZoneLabel: "Dublin",
    reminderHour: 8,
  },
  contacts: {
    checkinShareEmail: "laptop@speedcubingireland.com",
    sponsorshipTeamEmail: "sponsorship@speedcubingireland.com",
    sponsorshipTeamName: "Sponsorship Team",
  },
  sponsorship: {
    portalName: "Speedcubing Ireland Sponsor Portal",
    productionHost: "sponsors.speedcubingireland.com",
    defaultCurrency: "EUR",
  },
  wca: {
    scheduleTemplateCompetitionId: "IrelandTemplate2100",
  },
  features: {
    google: true,
    canva: true,
    discord: true,
    sponsors: true,
    socialMedia: true,
    wcaIntegration: true,
    wca2fa: false,
    organiserInvites: false,
  },
  auth: {
    providers: [
      {
        id: "google",
        audience: "staff",
        label: "Speedcubing Ireland Volunteer (GSuite)",
        hostedDomain: "speedcubingireland.com",
      },
      {
        id: "wca",
        audience: "organiser",
        label: "External Organiser (WCA)",
      },
    ],
  },
} as const satisfies OrganisationConfigDefinition

export default defineOrganisationConfig(organisationConfig)
