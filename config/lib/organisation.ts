import organisationConfig from "../organisation-config"
import type { FeatureId, LoginProviderConfig } from "./organisation-schema"

export { organisationConfig }
export type { FeatureId, LoginProviderConfig }

export function isFeatureEnabled(feature: FeatureId): boolean {
  return organisationConfig.features[feature]
}

type ConfiguredProvider = (typeof organisationConfig.auth.providers)[number]

export function loginProvider<Id extends LoginProviderConfig["id"]>(
  id: Id
): Extract<LoginProviderConfig, { id: Id }> | undefined {
  return organisationConfig.auth.providers.find(
    (provider): provider is Extract<ConfiguredProvider, { id: Id }> =>
      provider.id === id
  )
}

export function configuredSponsorshipSenderAddress(): string {
  return `${organisationConfig.contacts.sponsorshipTeamName} <${organisationConfig.contacts.sponsorshipTeamEmail}>`
}
