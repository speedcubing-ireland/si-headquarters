import { collectAll } from "@/convex/utils"
import { query } from "@/convex/_generated/server"
import type { Doc } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { requireActiveUserId } from "@/convex/permissions/principal"
import { phaseColor, phaseOwnerRef } from "./validators"
import { v } from "convex/values"

function listPhasesForOwner(ctx: QueryCtx, owner: Doc<"phases">["owner"]) {
  return ctx.db
    .query("phases")
    .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
      q.eq("owner.type", owner.type).eq("owner.id", owner.id)
    )
    .collect()
}

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("phases"),
      name: v.string(),
      color: phaseColor,
      owner: phaseOwnerRef,
    })
  ),
  handler: async (ctx) => {
    await requireActiveUserId(ctx)
    const phases = await collectAll(ctx, "phases")
    return phases.map((phase) => ({
      _id: phase._id,
      name: phase.name,
      color: phase.color,
      owner: phase.owner,
    }))
  },
})

export const listForOwner = query({
  args: {
    owner: phaseOwnerRef,
  },
  returns: v.array(
    v.object({
      _id: v.id("phases"),
      _creationTime: v.number(),
      name: v.string(),
      color: phaseColor,
      owner: phaseOwnerRef,
      sortKey: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    await requireActiveUserId(ctx)
    return await listPhasesForOwner(ctx, args.owner)
  },
})
