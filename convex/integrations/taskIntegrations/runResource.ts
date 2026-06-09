import { ConvexError } from "convex/values"
import { DEFAULT_RESOURCE_KEYS } from "@/convex/integrations/constants"
import type { TaskIntegrationRunContext } from "@/convex/integrations/taskIntegrations/pluginContract"
import type {
  LinkedResourceData,
  LinkedResourceType,
} from "@/convex/integrations/validators"

type GoogleSheetLinkedResource = Extract<
  LinkedResourceData,
  { resourceType: "googleSheet" }
>
type WcaCompetitionLinkedResource = Extract<
  LinkedResourceData,
  { resourceType: "wcaCompetition" }
>
type DiscordChannelLinkedResource = Extract<
  LinkedResourceData,
  { resourceType: "discordChannel" }
>

export function requireRunResource(
  run: TaskIntegrationRunContext,
  resourceType: "googleSheet",
  resourceKey?: string
): GoogleSheetLinkedResource
export function requireRunResource(
  run: TaskIntegrationRunContext,
  resourceType: "wcaCompetition",
  resourceKey?: string
): WcaCompetitionLinkedResource
export function requireRunResource(
  run: TaskIntegrationRunContext,
  resourceType: "discordChannel",
  resourceKey?: string
): DiscordChannelLinkedResource
export function requireRunResource(
  run: TaskIntegrationRunContext,
  resourceType: LinkedResourceType,
  resourceKey?: string
): LinkedResourceData {
  const resolvedResourceKey = resourceKey ?? DEFAULT_RESOURCE_KEYS[resourceType]
  const data = run.resources[`${resourceType}:${resolvedResourceKey}`]
  if (data === undefined) {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message: `Missing ${resourceType} resource '${resolvedResourceKey}' for this competition.`,
    })
  }
  if (data.resourceType !== resourceType) {
    throw new ConvexError({
      code: "PRECONDITION_FAILED",
      message: `Linked ${resourceType} resource has an unexpected shape.`,
    })
  }
  return data
}
