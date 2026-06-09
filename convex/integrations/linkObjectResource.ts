"use node"

import type { Id } from "@/convex/_generated/dataModel"
import { internal } from "@/convex/_generated/api"
import type { ActionCtx } from "@/convex/_generated/server"
import type {
  LinkedResourceData,
  LinkedResourceType,
} from "@/convex/integrations/validators"
import type { CompetitionOrProjectRef } from "@/convex/utils"
import { DEFAULT_RESOURCE_KEYS } from "@/convex/integrations/constants"

export async function upsertLinkedObjectResource(
  ctx: ActionCtx,
  args: {
    object: CompetitionOrProjectRef
    resourceType: LinkedResourceType
    resourceKey?: string
    data: LinkedResourceData
  }
): Promise<Id<"objectLinkedResources">> {
  await ctx.runQuery(internal.access.authorize.assertObjectUpdateAccess, {
    object: args.object,
  })

  return await ctx.runMutation(
    internal.integrations.objectResourcesModel.upsertResource,
    {
      object: args.object,
      resourceType: args.resourceType,
      resourceKey: args.resourceKey ?? DEFAULT_RESOURCE_KEYS[args.resourceType],
      data: args.data,
    }
  )
}
