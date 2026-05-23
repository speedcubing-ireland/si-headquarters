import { query } from "@/convex/_generated/server"
import type { Doc } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"

import { phaseOwnerRef } from "./validators"

function listPhasesForOwner(ctx: QueryCtx, owner: Doc<"phases">["owner"]) {
  return ctx.db
    .query("phases")
    .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
      q.eq("owner.type", owner.type).eq("owner.id", owner.id)
    )
    .collect()
}

export const listForOwner = query({
  args: {
    owner: phaseOwnerRef,
  },
  handler: async (ctx, args) => {
    return await listPhasesForOwner(ctx, args.owner)
  },
})
