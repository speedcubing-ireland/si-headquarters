"use node"

import { internal } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { ActionCtx } from "@/convex/_generated/server"
import { DEFAULT_RESOURCE_KEYS } from "@/convex/plugins/core/constants"
import type {
  CompetitionResourceData,
  CompetitionResourceType,
} from "@/convex/plugins/core/validators"

export async function upsertLinkedCompetitionResource(
  ctx: ActionCtx,
  args: {
    competitionId: Id<"competitions">
    resourceType: CompetitionResourceType
    resourceKey?: string
    data: CompetitionResourceData
    afterUpsert?: (
      resourceId: Id<"competitionLinkedResources">
    ) => Promise<void>
  }
): Promise<Id<"competitionLinkedResources">> {
  await ctx.runQuery(
    internal.plugins.core.authorize.assertCompetitionUpdateAccess,
    { competitionId: args.competitionId }
  )

  const resourceId = await ctx.runMutation(
    internal.plugins.core.competitionResourcesInternal.upsertResource,
    {
      competitionId: args.competitionId,
      resourceType: args.resourceType,
      resourceKey: args.resourceKey ?? DEFAULT_RESOURCE_KEYS[args.resourceType],
      data: args.data,
    }
  )

  if (args.afterUpsert !== undefined) {
    await args.afterUpsert(resourceId)
  }

  return resourceId
}
