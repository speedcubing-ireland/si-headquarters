import organisationConfig from "../organisation-config"
import type {
  FeatureId,
  LoginProviderConfig,
  OrganisationConfig,
  OrganisationConfigDefinition,
} from "./organisation-schema"

export { organisationConfig }
export type { FeatureId, LoginProviderConfig, OrganisationConfig }

export function isFeatureEnabled(feature: FeatureId): boolean {
  return organisationConfig.features[feature]
}

type ConfiguredProvider = (typeof organisationConfig.auth.providers)[number]
export type ConfiguredLoginProviderId = ConfiguredProvider["id"]
export type ConfiguredLoginProviderConfig<Id extends ConfiguredLoginProviderId> =
  Extract<ConfiguredProvider, { id: Id }>

const configuredProvidersById: Partial<
  Record<ConfiguredLoginProviderId, ConfiguredProvider>
> = {}
for (const provider of organisationConfig.auth.providers) {
  configuredProvidersById[provider.id] = provider
}

export function loginProvider(
  id: ConfiguredLoginProviderId
): ConfiguredProvider | undefined {
  return configuredProvidersById[id]
}

export function findLoginProvider(
  id: LoginProviderConfig["id"]
): LoginProviderConfig | undefined {
  return organisationConfig.auth.providers.find((provider) => provider.id === id)
}

type SponsorshipEnabledConfig = OrganisationConfigDefinition & {
  contacts: OrganisationConfig["contacts"] & {
    sponsorshipTeamEmail: string
    sponsorshipTeamName: string
  }
  sponsorship: NonNullable<OrganisationConfig["sponsorship"]>
}

function assertSponsorshipEnabled(
  config: OrganisationConfigDefinition
): asserts config is SponsorshipEnabledConfig {
  if (!config.features.sponsors) {
    throw new Error(
      "Sponsorship config was requested while sponsors are disabled."
    )
  }

  const { sponsorshipTeamEmail, sponsorshipTeamName } = config.contacts
  if (
    sponsorshipTeamEmail === undefined ||
    sponsorshipTeamName === undefined ||
    config.sponsorship === undefined
  ) {
    throw new Error("Sponsorship config is incomplete.")
  }
}

export function sponsorshipConfig(): SponsorshipEnabledConfig {
  assertSponsorshipEnabled(organisationConfig)
  return organisationConfig
}

export function configuredSponsorshipSenderAddress(): string {
  const config = sponsorshipConfig()

  return `${config.contacts.sponsorshipTeamName} <${config.contacts.sponsorshipTeamEmail}>`
}

type CheckinSheetsEnabledConfig = OrganisationConfigDefinition & {
  contacts: OrganisationConfig["contacts"] & {
    checkinShareEmail: string
  }
  wca: NonNullable<OrganisationConfig["wca"]>
}

function assertCheckinSheetsEnabled(
  config: OrganisationConfigDefinition
): asserts config is CheckinSheetsEnabledConfig {
  if (!config.features.google || !config.features.wcaIntegration) {
    throw new Error(
      "Check-in sheets config was requested while Google or WCA integration is disabled."
    )
  }

  if (config.contacts.checkinShareEmail === undefined || config.wca === undefined) {
    throw new Error("Check-in sheets config is incomplete.")
  }
}

export function checkinSheetsConfig(): CheckinSheetsEnabledConfig {
  assertCheckinSheetsEnabled(organisationConfig)
  return organisationConfig
}
