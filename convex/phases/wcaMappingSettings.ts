import { v } from "convex/values"
import { mutation, query } from "@/convex/_generated/server"
import { requireDirector } from "@/convex/permissions/principal"
import { phaseColor, wcaPhaseMappingEntry } from "@/convex/phases/validators"
import {
  assertMappingsValid,
  defaultMappings,
  loadMappingRow,
  normalizeMappings,
  templatePhaseOptions,
  WCA_PHASE_MAPPING_KEY,
} from "@/convex/phases/wcaMappingModel"

const templatePhaseValidator = v.object({
  key: v.string(),
  name: v.string(),
  color: phaseColor,
})

/**
 * The mapping as the admin screen needs it: the effective mapping (stored row
 * merged over the template defaults), the template's phases to populate the
 * dropdowns, and whether an override is in force so the screen can offer
 * "Reset to defaults" meaningfully.
 */
export const get = query({
  args: {},
  returns: v.object({
    templateName: v.string(),
    phases: v.array(templatePhaseValidator),
    mappings: v.array(wcaPhaseMappingEntry),
    isCustomised: v.boolean(),
    updatedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    await requireDirector(ctx)
    const row = await loadMappingRow(ctx)

    return {
      ...templatePhaseOptions(),
      mappings:
        row === null ? defaultMappings() : normalizeMappings(row.mappings),
      isCustomised: row !== null,
      updatedAt: row?.updatedAt ?? null,
    }
  },
})

export const update = mutation({
  args: {
    mappings: v.array(wcaPhaseMappingEntry),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorId = await requireDirector(ctx)

    assertMappingsValid(args.mappings)

    const existing = await loadMappingRow(ctx)
    const fields = {
      key: WCA_PHASE_MAPPING_KEY,
      mappings: args.mappings,
      updatedById: actorId,
      updatedAt: Date.now(),
    }

    if (existing === null) {
      await ctx.db.insert("wcaPhaseMappings", fields)
    } else {
      await ctx.db.patch("wcaPhaseMappings", existing._id, fields)
    }

    return null
  },
})

/** Drops the override so the template's own defaults apply again. */
export const resetToDefaults = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireDirector(ctx)
    const existing = await loadMappingRow(ctx)

    if (existing !== null) {
      await ctx.db.delete("wcaPhaseMappings", existing._id)
    }

    return null
  },
})
