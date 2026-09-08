import { ConvexError } from "convex/values"
import type { QueryCtx } from "@/convex/_generated/server"
import {
  milestoneRank,
  WCA_MILESTONES,
  type WcaMilestone,
} from "@/convex/phases/wcaMilestones"
import {
  standardCompetitionTemplate,
  type CompetitionTemplateDefinition,
} from "@/convex/templates/registry"

/**
 * The mapping targets template phase keys, and competitions are all created
 * from the one competition template, so it is referenced directly rather than
 * looked up. Should a second template appear, this is the point to make the
 * mapping per-template — and the competition would need to record which
 * template built it, which it does not today.
 */
// Typed as the interface rather than the literal so phase specs that omit
// `wcaMilestone` still expose it as optional.
const TEMPLATE: CompetitionTemplateDefinition = standardCompetitionTemplate

/** Single settings row, following `sponsorshipAuctionSettings`. */
export const WCA_PHASE_MAPPING_KEY = "default"

export interface WcaPhaseMapping {
  milestone: WcaMilestone
  phaseKey: string | null
}

/** Template phases as key → name and position, for validation and display. */
function templatePhaseByKey() {
  return new Map(
    TEMPLATE.phases.map((phase, index) => [
      phase.key,
      { name: phase.name, index },
    ])
  )
}

/** The mapping the template ships with, before any admin override. */
export function defaultMappings(): WcaPhaseMapping[] {
  return WCA_MILESTONES.map((milestone) => ({
    milestone,
    phaseKey:
      TEMPLATE.phases.find((phase) => phase.wcaMilestone === milestone)?.key ??
      null,
  }))
}

/**
 * Normalises a stored mapping into one entry per milestone, in ladder order.
 * Milestones the stored row doesn't mention are treated as unmapped, so adding
 * a milestone to the ladder never resurrects a stale phase.
 */
export function normalizeMappings(
  stored: readonly WcaPhaseMapping[]
): WcaPhaseMapping[] {
  const byMilestone = new Map(
    stored.map((mapping) => [mapping.milestone, mapping.phaseKey])
  )
  return WCA_MILESTONES.map((milestone) => ({
    milestone,
    phaseKey: byMilestone.get(milestone) ?? null,
  }))
}

export function loadMappingRow(ctx: QueryCtx) {
  return ctx.db
    .query("wcaPhaseMappings")
    .withIndex("by_key", (q) => q.eq("key", WCA_PHASE_MAPPING_KEY))
    .unique()
}

export async function loadMappings(ctx: QueryCtx): Promise<WcaPhaseMapping[]> {
  const row = await loadMappingRow(ctx)
  return row === null ? defaultMappings() : normalizeMappings(row.mappings)
}

/**
 * Rejects a mapping that would make the sync behave unpredictably. Checked once
 * here, at config time, rather than per competition:
 *
 * - every phase key must exist in the template;
 * - a phase may back at most one milestone, otherwise "furthest phase reached"
 *   is ambiguous;
 * - milestone order must agree with the template's phase order, otherwise a
 *   later milestone could resolve to an earlier phase and the sync would
 *   silently never advance past it.
 */
export function assertMappingsValid(
  mappings: readonly WcaPhaseMapping[]
): void {
  const phaseByKey = templatePhaseByKey()

  const seenPhaseKeys = new Set<string>()
  for (const mapping of mappings) {
    if (mapping.phaseKey === null) continue

    const phase = phaseByKey.get(mapping.phaseKey)
    if (phase === undefined) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `"${mapping.phaseKey}" is not a phase of this competition template.`,
      })
    }

    if (seenPhaseKeys.has(mapping.phaseKey)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `${phase.name} is mapped to more than one WCA milestone. Each phase can back at most one.`,
      })
    }
    seenPhaseKeys.add(mapping.phaseKey)
  }

  // Resolve to phases up front so the ordering check works on template
  // positions rather than nullable keys.
  const ordered = [...mappings]
    .sort((a, b) => milestoneRank(a.milestone) - milestoneRank(b.milestone))
    .flatMap((mapping) => {
      const phase =
        mapping.phaseKey === null ? undefined : phaseByKey.get(mapping.phaseKey)
      return phase === undefined ? [] : [phase]
    })

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]
    const current = ordered[index]
    if (current.index <= previous.index) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `${current.name} comes before ${previous.name} in the phase order, so it cannot be mapped to a later WCA milestone. Later milestones must map to later phases.`,
      })
    }
  }
}

/** The template's phases, as the admin screen's dropdown options. */
export function templatePhaseOptions() {
  return {
    templateName: TEMPLATE.name,
    phases: TEMPLATE.phases.map((phase) => ({
      key: phase.key,
      name: phase.name,
      color: phase.color,
    })),
  }
}
