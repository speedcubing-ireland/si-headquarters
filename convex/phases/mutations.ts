import { ConvexError } from "convex/values"
import { mutation } from "@/convex/_generated/server"
import type { Id } from "@/convex/_generated/dataModel"
import { requireScopedObjectForUpdate } from "@/convex/access/scopedObject"
import {
  clearOwnerCurrentPhaseId,
  getOwnerCurrentPhaseId,
  hasPhaseTasks,
  listPhasesForOwnerBounded,
  MAX_PHASES_FOR_OWNER,
} from "@/convex/phases/model"
import { phaseColor } from "@/convex/phases/validators"
import { competitionOrProjectRef } from "@/convex/utils"
import { v } from "convex/values"
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing"

function normalizedPhaseName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Phase name is required.",
    })
  }
  return trimmed
}

export const createForOwner = mutation({
  args: {
    owner: competitionOrProjectRef,
    name: v.string(),
    color: phaseColor,
  },
  returns: v.id("phases"),
  handler: async (ctx, args) => {
    await requireScopedObjectForUpdate(ctx, args.owner)
    const name = normalizedPhaseName(args.name)

    const phases = await listPhasesForOwnerBounded(ctx, args.owner)
    const lastSortKey = phases.at(-1)?.sortKey ?? null
    const sortKey = generateKeyBetween(lastSortKey, null)

    return await ctx.db.insert("phases", {
      name,
      owner: args.owner,
      sortKey,
      color: args.color,
    })
  },
})

export const setDetails = mutation({
  args: {
    id: v.id("phases"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const phase = await ctx.db.get("phases", args.id)
    if (phase === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Phase not found",
      })
    }
    await requireScopedObjectForUpdate(ctx, phase.owner)
    const name = normalizedPhaseName(args.name)
    await ctx.db.patch("phases", args.id, { name })
    return null
  },
})

export const setColor = mutation({
  args: {
    id: v.id("phases"),
    color: phaseColor,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const phase = await ctx.db.get("phases", args.id)
    if (phase === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Phase not found",
      })
    }
    await requireScopedObjectForUpdate(ctx, phase.owner)
    await ctx.db.patch("phases", args.id, { color: args.color })
    return null
  },
})

export const setOrder = mutation({
  args: {
    owner: competitionOrProjectRef,
    phaseIds: v.array(v.id("phases")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireScopedObjectForUpdate(ctx, args.owner)
    const phases = await listPhasesForOwnerBounded(ctx, args.owner)
    const phaseById = new Map(phases.map((phase) => [phase._id, phase]))

    if (args.phaseIds.length !== phases.length) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Phase order must include every phase for this owner.",
      })
    }

    const uniqueIds = new Set(args.phaseIds)
    if (uniqueIds.size !== args.phaseIds.length) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Phase order contains duplicate ids.",
      })
    }

    for (const phaseId of args.phaseIds) {
      if (!phaseById.has(phaseId)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Phase order includes an unknown phase.",
        })
      }
    }

    const sortKeys = generateNKeysBetween(null, null, args.phaseIds.length)
    for (let index = 0; index < args.phaseIds.length; index += 1) {
      await ctx.db.patch("phases", args.phaseIds[index], {
        sortKey: sortKeys[index],
      })
    }

    return null
  },
})

export const deleteEmptyPhase = mutation({
  args: {
    id: v.id("phases"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const phase = await ctx.db.get("phases", args.id)
    if (phase === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Phase not found",
      })
    }
    await requireScopedObjectForUpdate(ctx, phase.owner)

    if (await hasPhaseTasks(ctx, args.id)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Delete tasks in this phase before deleting it.",
      })
    }

    const currentPhaseId = await getOwnerCurrentPhaseId(ctx, phase.owner)
    if (currentPhaseId === args.id) {
      await clearOwnerCurrentPhaseId(ctx, phase.owner)
    }

    await ctx.db.delete("phases", args.id)
    return null
  },
})

export const saveForOwner = mutation({
  args: {
    owner: competitionOrProjectRef,
    phases: v.array(
      v.object({
        id: v.union(v.id("phases"), v.null()),
        name: v.string(),
        color: phaseColor,
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireScopedObjectForUpdate(ctx, args.owner)
    if (args.phases.length > MAX_PHASES_FOR_OWNER) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Too many phases to manage at once.",
      })
    }

    const existingPhases = await listPhasesForOwnerBounded(ctx, args.owner)
    const existingById = new Map(
      existingPhases.map((phase) => [phase._id, phase])
    )
    const submittedIds = new Set<Id<"phases">>()
    const currentPhaseId = await getOwnerCurrentPhaseId(ctx, args.owner)
    const sortKeys = generateNKeysBetween(null, null, args.phases.length)

    for (const [index, phase] of args.phases.entries()) {
      const name = normalizedPhaseName(phase.name)
      const sortKey = sortKeys[index]

      if (phase.id === null) {
        await ctx.db.insert("phases", {
          name,
          owner: args.owner,
          sortKey,
          color: phase.color,
        })
        continue
      }

      if (submittedIds.has(phase.id)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Phase list contains duplicate phases.",
        })
      }
      submittedIds.add(phase.id)

      const existing = existingById.get(phase.id)
      if (existing === undefined) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Phase list includes an unknown phase.",
        })
      }

      await ctx.db.patch("phases", phase.id, {
        name,
        color: phase.color,
        sortKey,
      })
    }

    for (const existing of existingPhases) {
      if (submittedIds.has(existing._id)) continue

      if (currentPhaseId === existing._id) {
        await clearOwnerCurrentPhaseId(ctx, args.owner)
      }

      if (await hasPhaseTasks(ctx, existing._id)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Delete tasks in a phase before deleting it.",
        })
      }

      await ctx.db.delete("phases", existing._id)
    }

    return null
  },
})
