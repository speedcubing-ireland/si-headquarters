import { v, type Infer } from "convex/values"
import {
  LINKED_RESOURCE_TYPES,
  INTEGRATION_SERVICES,
  OAUTH_SERVICES,
} from "@/convex/integrations/constants"
import { competitionOrProjectRef, literalUnion } from "@/convex/utils"

export const integrationService = literalUnion(INTEGRATION_SERVICES)

export const oauthService = literalUnion(OAUTH_SERVICES)

export const linkedResourceType = literalUnion(LINKED_RESOURCE_TYPES)

export const googleSheetResourceData = v.object({
  sheetId: v.string(),
  title: v.string(),
  url: v.string(),
})

export const wcaCompetitionLinkedResourceData = v.object({
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

export const linkedResourceData = v.union(
  v.object({
    resourceType: v.literal("googleSheet"),
    ...googleSheetResourceData.fields,
  }),
  v.object({
    resourceType: v.literal("wcaCompetition"),
    ...wcaCompetitionLinkedResourceData.fields,
  }),
  v.object({
    resourceType: v.literal("discordChannel"),
    ...discordChannelResourceData.fields,
  })
)

export const objectLinkedResourceFields = {
  object: competitionOrProjectRef,
  resourceType: linkedResourceType,
  resourceKey: v.string(),
  data: linkedResourceData,
}

export const objectLinkedResourceRow = v.object({
  _id: v.id("objectLinkedResources"),
  _creationTime: v.number(),
  ...objectLinkedResourceFields,
})
export type LinkedResourceType = Infer<typeof linkedResourceType>
export type LinkedResourceData = Infer<typeof linkedResourceData>
export type IntegrationService = Infer<typeof integrationService>
export type OAuthService = Infer<typeof oauthService>
