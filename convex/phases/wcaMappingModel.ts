import { ConvexError } from "convex/values"
import type { QueryCtx } from "@/convex/_generated/server"
import {
  milestoneRank,
  WCA_MILESTONES,
  type WcaMilestone,
} from "@/convex/phases/wcaMilestones"
import {
  getCompetitionTemplate,
  standardCompetitionTemplate,
} from "@/convex/templates/registry"

/**
 * The template competitions are created from today. The mapping is stored per
 * template so a second template can carry its own mapping later without a
 * migration.
 */
export const DEFAULT_COMPETITION_TEMPLATE_KEY = standardCompetitionTemplate.key

export interface WcaPhaseMapping {
  milestone: WcaMilestone
  phaseKey: string | null
}

interface TemplatePhase {
  key: string
  name: string
  /** Position in the template's phase order. */
  index: number
}

function templatePhases(templateKey: string): TemplatePhase[] {
  const template = getCompetitionTemplate(templateKey)
  if (template === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: `Unknown competition template "${templateKey}".`,
    })
  }
  return template.phases.map((phase, index) => ({
    key: phase.key,
    name: phase.name,
    index,
  }))
}

/** The mapping a template ships with, before any admin override. */
export function defaultMappingsForTemplate(
  templateKey: string
): WcaPhaseMapping[] {
  const template = getCompetitionTemplate(templateKey)
  if (template === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: `Unknown competition template "${templateKey}".`,
    })
  }
  return WCA_MILESTONES.map((milestone) => ({
    milestone,
    phaseKey:
      template.phases.find((phase) => phase.wcaMilestone === milestone)?.key ??
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

export async function loadMappingsForTemplate(
  ctx: QueryCtx,
  templateKey: string
): Promise<WcaPhaseMapping[]> {
  const row = await ctx.db
    .query("wcaPhaseMappings")
    .withIndex("by_templateKey", (q) => q.eq("templateKey", templateKey))
    .unique()
  if (row === null) {
    return defaultMappingsForTemplate(templateKey)
  }
  return normalizeMappings(row.mappings)
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
  templateKey: string,
  mappings: readonly WcaPhaseMapping[]
): void {
  const phases = templatePhases(templateKey)
  const phaseByKey = new Map(phases.map((phase) => [phase.key, phase]))

  const seenPhaseKeys = new Map<string, WcaMilestone>()
  for (const mapping of mappings) {
    if (mapping.phaseKey === null) continue

    const phase = phaseByKey.get(mapping.phaseKey)
    if (phase === undefined) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `"${mapping.phaseKey}" is not a phase of this competition template.`,
      })
    }

    const existing = seenPhaseKeys.get(mapping.phaseKey)
    if (existing !== undefined) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `${phase.name} is mapped to more than one WCA milestone. Each phase can back at most one.`,
      })
    }
    seenPhaseKeys.set(mapping.phaseKey, mapping.milestone)
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
