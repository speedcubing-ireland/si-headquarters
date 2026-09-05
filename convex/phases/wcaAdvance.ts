import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { WcaMilestone } from "@/convex/phases/wcaMilestones"
import type { WcaPhaseMapping } from "@/convex/phases/wcaMappingModel"

/**
 * Decides which phase a competition should be in given the WCA milestones it
 * has reached. Pure: the caller supplies the competition's phases and the
 * org mapping, and applies the result.
 *
 * WCA status is a floor, not the phase. It says a competition has reached *at
 * least* a certain point, so this only ever moves forward — a phase a human
 * moved into early is never undone, and phases nothing maps to (Concept, and
 * anything hand-created) are never targeted.
 */
export function resolveWcaPhaseAdvance(args: {
  phases: readonly Doc<"phases">[]
  currentPhaseId: Id<"phases"> | null
  mappings: readonly WcaPhaseMapping[]
  reached: ReadonlySet<WcaMilestone>
}): Id<"phases"> | null {
  const phaseByTemplateKey = new Map<string, Doc<"phases">>()
  for (const phase of args.phases) {
    if (phase.templateKey !== undefined) {
      phaseByTemplateKey.set(phase.templateKey, phase)
    }
  }

  // Every phase a reached milestone unlocks. A mapping whose phase this
  // competition doesn't have (deleted, or never created from the template) is
  // simply skipped.
  const unlocked: Doc<"phases">[] = []
  for (const mapping of args.mappings) {
    if (mapping.phaseKey === null) continue
    if (!args.reached.has(mapping.milestone)) continue
    const phase = phaseByTemplateKey.get(mapping.phaseKey)
    if (phase !== undefined) {
      unlocked.push(phase)
    }
  }

  if (unlocked.length === 0) return null

  // Furthest unlocked phase, by the competition's own phase order.
  const target = unlocked.reduce((furthest, phase) =>
    phase.sortKey > furthest.sortKey ? phase : furthest
  )

  if (args.currentPhaseId === null) return target._id
  if (target._id === args.currentPhaseId) return null

  const current = args.phases.find((phase) => phase._id === args.currentPhaseId)
  // Current phase isn't one of this competition's rows — leave it alone rather
  // than guessing.
  if (current === undefined) return null

  return target.sortKey > current.sortKey ? target._id : null
}
