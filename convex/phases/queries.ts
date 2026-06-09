import { collectAll, competitionOrProjectRef } from "@/convex/utils"
import { query } from "@/convex/_generated/server"
import { requireActiveUserId } from "@/convex/permissions/principal"
import {
  getOwnerCurrentPhaseId,
  hasPhaseTasks,
  listPhasesForOwner,
  MAX_PHASES_FOR_OWNER,
} from "@/convex/phases/model"
import { phaseColor } from "./validators"
import { v } from "convex/values"

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("phases"),
      name: v.string(),
      color: phaseColor,
      owner: competitionOrProjectRef,
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
    owner: competitionOrProjectRef,
  },
  returns: v.array(
    v.object({
      _id: v.id("phases"),
      _creationTime: v.number(),
      name: v.string(),
      color: phaseColor,
      owner: competitionOrProjectRef,
      sortKey: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    await requireActiveUserId(ctx)
    return await listPhasesForOwner(ctx, args.owner)
  },
})

export const listManageForOwner = query({
  args: {
    owner: competitionOrProjectRef,
  },
  returns: v.array(
    v.object({
      _id: v.id("phases"),
      _creationTime: v.number(),
      name: v.string(),
      color: phaseColor,
      owner: competitionOrProjectRef,
      sortKey: v.string(),
      hasTasks: v.boolean(),
      isCurrent: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    await requireActiveUserId(ctx)
    const [phases, currentPhaseId] = await Promise.all([
      ctx.db
        .query("phases")
        .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
          q.eq("owner.type", args.owner.type).eq("owner.id", args.owner.id)
        )
        .order("asc")
        .take(MAX_PHASES_FOR_OWNER + 1),
      getOwnerCurrentPhaseId(ctx, args.owner),
    ])

    if (phases.length > MAX_PHASES_FOR_OWNER) {
      throw new Error("Too many phases to manage at once.")
    }

    return await Promise.all(
      phases.map(async (phase) => ({
        ...phase,
        hasTasks: await hasPhaseTasks(ctx, phase._id),
        isCurrent: phase._id === currentPhaseId,
      }))
    )
  },
})
