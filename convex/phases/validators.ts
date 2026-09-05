import { v } from "convex/values"
import { competitionOrProjectRef, literalUnion } from "@/convex/utils"
import { PHASE_COLORS } from "@/convex/phases/colors"
import { WCA_MILESTONES } from "@/convex/phases/wcaMilestones"

export const phaseColor = literalUnion(PHASE_COLORS)

export const wcaMilestone = literalUnion(WCA_MILESTONES)

export const wcaPhaseMappingEntry = v.object({
  milestone: wcaMilestone,
  /** Template phase key this milestone advances to, or null when unmapped. */
  phaseKey: v.union(v.string(), v.null()),
})

/**
 * Org-level mapping from WCA milestone to template phase, one row per
 * competition template. An absent row means "use the template's own defaults",
 * so a fresh deployment works without configuration.
 */
export const wcaPhaseMappingsFields = {
  templateKey: v.string(),
  mappings: v.array(wcaPhaseMappingEntry),
  updatedById: v.id("users"),
  updatedAt: v.number(),
}

export const phasesFields = {
  name: v.string(),
  owner: competitionOrProjectRef,
  sortKey: v.string(),
  color: phaseColor,
  /**
   * Key of the template phase this row was created from. Phases are per-owner
   * rows and can be freely renamed, so this is the only stable identifier a
   * cross-competition mapping (see `wcaPhaseMappings`) can target. Absent on
   * hand-created phases and on rows predating the WCA phase sync.
   */
  templateKey: v.optional(v.string()),
}
