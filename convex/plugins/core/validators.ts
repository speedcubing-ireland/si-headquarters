import { v, type Infer, type Validator } from "convex/values"
import {
  COMPETITION_RESOURCE_TYPES,
  INTEGRATION_SERVICES,
  MANUAL_TASK_INTEGRATION_STATUSES,
  OAUTH_SERVICES,
  TASK_INTEGRATION_IDS,
  TASK_INTEGRATION_STATUSES,
} from "@/convex/plugins/core/constants"

function literalUnion<
  const Values extends readonly [string, string, ...string[]],
>(values: Values): Validator<Values[number]> {
  const [first, second, ...rest] = values
  return v.union(
    v.literal(first),
    v.literal(second),
    ...rest.map((value) => v.literal(value))
  ) satisfies Validator<Values[number]>
}

export const integrationService = literalUnion(INTEGRATION_SERVICES)

export const oauthService = literalUnion(OAUTH_SERVICES)

export const taskIntegrationRunInput = v.object({
  overwriteEvents: v.optional(v.boolean()),
})

export const competitionResourceType = literalUnion(COMPETITION_RESOURCE_TYPES)

export const googleSheetResourceData = v.object({
  sheetId: v.string(),
  title: v.string(),
  url: v.string(),
})

export const wcaCompetitionResourceData = v.object({
  wcaCompetitionId: v.string(),
  url: v.string(),
  name: v.string(),
})

export const discordChannelResourceData = v.object({
  guildId: v.string(),
  channelId: v.string(),
  channelName: v.string(),
})

export type DiscordChannelResourceData = Infer<
  typeof discordChannelResourceData
>

export const competitionResourceData = v.union(
  v.object({
    resourceType: v.literal("googleSheet"),
    ...googleSheetResourceData.fields,
  }),
  v.object({
    resourceType: v.literal("wcaCompetition"),
    ...wcaCompetitionResourceData.fields,
  }),
  v.object({
    resourceType: v.literal("discordChannel"),
    ...discordChannelResourceData.fields,
  })
)

export const taskIntegrationId = literalUnion(TASK_INTEGRATION_IDS)

export const taskIntegrationStatus = literalUnion(TASK_INTEGRATION_STATUSES)

export const manualTaskIntegrationStatus = literalUnion(
  MANUAL_TASK_INTEGRATION_STATUSES
)

export const taskIntegrationOutput = v.union(
  v.object({
    kind: v.literal("schedule_transfer"),
    wcifJson: v.optional(v.string()),
    wcaUrl: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("checkin_populate"),
    rowsWritten: v.optional(v.number()),
  }),
  v.object({
    kind: v.literal("canva_design"),
    designId: v.string(),
    designUrl: v.string(),
    thumbnailUrl: v.optional(v.string()),
  }),
  v.null()
)

export const competitionLinkedResourceRow = v.object({
  _id: v.id("competitionLinkedResources"),
  _creationTime: v.number(),
  competitionId: v.id("competitions"),
  resourceType: competitionResourceType,
  resourceKey: v.string(),
  data: competitionResourceData,
})

export const taskIntegrationDefinitionMeta = v.object({
  id: taskIntegrationId,
  label: v.string(),
  pluginId: v.string(),
})

export const loadedRunContext = v.object({
  integrationId: taskIntegrationId,
  competitionId: v.id("competitions"),
  competitionName: v.string(),
  resources: v.record(v.string(), competitionResourceData),
})

export type LoadedRunContext = Infer<typeof loadedRunContext>
export type CompetitionResourceType = Infer<typeof competitionResourceType>
export type CompetitionResourceData = Infer<typeof competitionResourceData>
export type TaskIntegrationId = Infer<typeof taskIntegrationId>
export type TaskIntegrationStatus = Infer<typeof taskIntegrationStatus>
export type ManualTaskIntegrationStatus = Infer<
  typeof manualTaskIntegrationStatus
>
export type IntegrationService = Infer<typeof integrationService>
export type OAuthService = Infer<typeof oauthService>
export type TaskIntegrationRunInput = Infer<typeof taskIntegrationRunInput>

export const taskIntegrationRow = v.object({
  _id: v.id("taskIntegrations"),
  _creationTime: v.number(),
  taskId: v.id("tasks"),
  integrationId: taskIntegrationId,
  status: taskIntegrationStatus,
  lastMessage: v.union(v.string(), v.null()),
  lastRunAt: v.union(v.number(), v.null()),
  runId: v.union(v.string(), v.null()),
  output: taskIntegrationOutput,
})

export const taskIntegrationListRow = v.object({
  ...taskIntegrationRow.fields,
  definition: taskIntegrationDefinitionMeta,
})
