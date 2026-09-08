import organisationConfig from "../organisation-config"
import { createOrganisationAccessors } from "./organisation-accessors"
import type {
  FeatureId,
  LoginProviderConfig,
  OrganisationConfig,
} from "./organisation-schema"

export { organisationConfig }
export type { FeatureId, LoginProviderConfig, OrganisationConfig }

export const {
  isFeatureEnabled,
  findLoginProvider,
  sponsorshipConfig,
  configuredSponsorshipSenderAddress,
  checkinSheetsConfig,
  competitionCountryIso2,
} = createOrganisationAccessors(organisationConfig)
