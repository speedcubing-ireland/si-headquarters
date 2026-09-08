import { collectAll, competitionOrProjectRef } from "@/convex/utils"
import type { Doc } from "@/convex/_generated/dataModel"
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

/**
 * The phase fields the client is given. Phase rows carry fields the UI has no
 * use for — `templateKey` exists only so the WCA sync can identify a phase
 * across renames — so rows are projected through `toPhaseRow` rather than
 * returned whole. Returning the document meant every field added to the schema
 * broke these queries' returns validators at runtime.
 */
const phaseRowFields = {
  _id: v.id("phases"),
  _creationTime: v.number(),
  name: v.string(),
  color: phaseColor,
  owner: competitionOrProjectRef,
  sortKey: v.string(),
}

function toPhaseRow(phase: Doc<"phases">) {
  return {
    _id: phase._id,
    _creationTime: phase._creationTime,
    name: phase.name,
    color: phase.color,
    owner: phase.owner,
    sortKey: phase.sortKey,
  }
}

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
  returns: v.array(v.object(phaseRowFields)),
  handler: async (ctx, args) => {
    await requireActiveUserId(ctx)
    const phases = await listPhasesForOwner(ctx, args.owner)
    return phases.map(toPhaseRow)
  },
})

export const listManageForOwner = query({
  args: {
    owner: competitionOrProjectRef,
  },
  returns: v.array(
    v.object({
      ...phaseRowFields,
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
        ...toPhaseRow(phase),
        hasTasks: await hasPhaseTasks(ctx, phase._id),
        isCurrent: phase._id === currentPhaseId,
      }))
    )
  },
})
