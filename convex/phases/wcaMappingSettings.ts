import { v } from "convex/values"
import { mutation, query } from "@/convex/_generated/server"
import { requireDirector } from "@/convex/permissions/principal"
import { phaseColor, wcaPhaseMappingEntry } from "@/convex/phases/validators"
import {
  assertMappingsValid,
  DEFAULT_COMPETITION_TEMPLATE_KEY,
  defaultMappingsForTemplate,
  loadMappingsForTemplate,
} from "@/convex/phases/wcaMappingModel"
import { getCompetitionTemplate } from "@/convex/templates/registry"

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
  args: {
    templateKey: v.optional(v.string()),
  },
  returns: v.object({
    templateKey: v.string(),
    templateName: v.string(),
    phases: v.array(templatePhaseValidator),
    mappings: v.array(wcaPhaseMappingEntry),
    defaults: v.array(wcaPhaseMappingEntry),
    isCustomised: v.boolean(),
    updatedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireDirector(ctx)
    const templateKey = args.templateKey ?? DEFAULT_COMPETITION_TEMPLATE_KEY
    const template = getCompetitionTemplate(templateKey)
    if (template === null) {
      throw new Error(`Unknown competition template "${templateKey}".`)
    }

    const row = await ctx.db
      .query("wcaPhaseMappings")
      .withIndex("by_templateKey", (q) => q.eq("templateKey", templateKey))
      .unique()

    return {
      templateKey,
      templateName: template.name,
      phases: template.phases.map((phase) => ({
        key: phase.key,
        name: phase.name,
        color: phase.color,
      })),
      mappings: await loadMappingsForTemplate(ctx, templateKey),
      defaults: defaultMappingsForTemplate(templateKey),
      isCustomised: row !== null,
      updatedAt: row?.updatedAt ?? null,
    }
  },
})

export const update = mutation({
  args: {
    templateKey: v.optional(v.string()),
    mappings: v.array(wcaPhaseMappingEntry),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorId = await requireDirector(ctx)
    const templateKey = args.templateKey ?? DEFAULT_COMPETITION_TEMPLATE_KEY

    assertMappingsValid(templateKey, args.mappings)

    const existing = await ctx.db
      .query("wcaPhaseMappings")
      .withIndex("by_templateKey", (q) => q.eq("templateKey", templateKey))
      .unique()

    const fields = {
      templateKey,
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
  args: {
    templateKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireDirector(ctx)
    const templateKey = args.templateKey ?? DEFAULT_COMPETITION_TEMPLATE_KEY

    const existing = await ctx.db
      .query("wcaPhaseMappings")
      .withIndex("by_templateKey", (q) => q.eq("templateKey", templateKey))
      .unique()

    if (existing !== null) {
      await ctx.db.delete("wcaPhaseMappings", existing._id)
    }

    return null
  },
})
