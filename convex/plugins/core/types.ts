/** Canonical plugin types: validators (Infer) + constants (literals). */

export {
  COMPETITION_RESOURCE_TYPES,
  DEFAULT_RESOURCE_KEYS,
  INTEGRATION_SERVICES,
  OAUTH_SERVICES,
  TASK_INTEGRATION_IDS,
  TASK_INTEGRATION_STATUSES,
} from "@/convex/plugins/core/constants"

export type {
  CompetitionResourceData,
  CompetitionResourceType,
  IntegrationService,
  LoadedRunContext,
  OAuthService,
  TaskIntegrationId,
  TaskIntegrationRunInput,
  TaskIntegrationStatus,
} from "@/convex/plugins/core/validators"
