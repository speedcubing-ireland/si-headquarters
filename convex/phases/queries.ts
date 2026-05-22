import { query } from "@/convex/_generated/server"
import type { Doc } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"

import { phaseOwnerId, phaseOwnerType } from "./validators"

function listPhasesForOwner(
  ctx: QueryCtx,
  ownerType: Doc<"phases">["ownerType"],
  ownerId: Doc<"phases">["ownerId"]
) {
  return ctx.db
    .query("phases")
    .withIndex("by_ownerType_and_ownerId_and_sortKey", (q) =>
      q.eq("ownerType", ownerType).eq("ownerId", ownerId)
    )
    .collect()
}

export const listForOwner = query({
  args: {
    ownerType: phaseOwnerType,
    ownerId: phaseOwnerId,
  },
  handler: async (ctx, args) => {
    return await listPhasesForOwner(ctx, args.ownerType, args.ownerId)
  },
});
