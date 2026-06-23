import type {
  CheckinSheetsConfigRequirements,
  FeatureId,
  LoginProviderConfig,
  OrganisationConfigDefinition,
  SponsorshipConfigRequirements,
} from "./organisation-schema"
import { checkinSheetsEnabled, sponsorshipEnabled } from "./organisation-schema"

type SponsorshipEnabledConfig = OrganisationConfigDefinition &
  SponsorshipConfigRequirements

function assertSponsorshipEnabled(
  config: OrganisationConfigDefinition
): asserts config is SponsorshipEnabledConfig {
  if (!sponsorshipEnabled(config.features)) {
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

type CheckinSheetsEnabledConfig = OrganisationConfigDefinition &
  CheckinSheetsConfigRequirements

function assertCheckinSheetsEnabled(
  config: OrganisationConfigDefinition
): asserts config is CheckinSheetsEnabledConfig {
  if (!checkinSheetsEnabled(config.features)) {
    throw new Error(
      "Check-in sheets config was requested while Google or WCA integration is disabled."
    )
  }

  if (
    config.contacts.checkinShareEmail === undefined ||
    config.wca === undefined
  ) {
    throw new Error("Check-in sheets config is incomplete.")
  }
}

export function createOrganisationAccessors(
  config: OrganisationConfigDefinition
) {
  function isFeatureEnabled(feature: FeatureId): boolean {
    return config.features[feature]
  }

  function findLoginProvider<Id extends LoginProviderConfig["id"]>(
    id: Id
  ): Extract<LoginProviderConfig, { id: Id }> | undefined {
    return config.auth.providers.find(
      (provider): provider is Extract<LoginProviderConfig, { id: Id }> =>
        provider.id === id
    )
  }

  function sponsorshipConfig(): SponsorshipEnabledConfig {
    assertSponsorshipEnabled(config)
    return config
  }

  function configuredSponsorshipSenderAddress(): string {
    const sponsorship = sponsorshipConfig()

    return `${sponsorship.contacts.sponsorshipTeamName} <${sponsorship.contacts.sponsorshipTeamEmail}>`
  }

  function checkinSheetsConfig(): CheckinSheetsEnabledConfig {
    assertCheckinSheetsEnabled(config)
    return config
  }

  return {
    isFeatureEnabled,
    findLoginProvider,
    sponsorshipConfig,
    configuredSponsorshipSenderAddress,
    checkinSheetsConfig,
  }
}
