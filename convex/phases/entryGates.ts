import type { Doc, Id } from "@/convex/_generated/dataModel"
import { isPhaseComplete } from "@/convex/phases/progress"
import type { StatusReadCtx } from "@/convex/tasks/status/resolver"
import {
  standardCompetitionTemplate,
  type CompetitionTemplateDefinition,
} from "@/convex/templates/registry"

/**
 * Competitions are all created from the one competition template, so it is
 * referenced directly rather than looked up — the same assumption, and the same
 * upgrade path, as `wcaMappingModel`.
 */
// Typed as the interface rather than the literal so phase specs that omit
// `requiresPhaseComplete` still expose it as optional.
const TEMPLATE: CompetitionTemplateDefinition = standardCompetitionTemplate

/**
 * Phases the WCA sync must not move a competition into yet, because a phase
 * they depend on still has outstanding work.
 *
 * The rule is declared on the phase being *entered*
 * (`requiresPhaseComplete` in the template registry) rather than derived from
 * anything the WCA reports, because it is a fact about our own tasks. Keeping
 * it here leaves `reachedMilestones` a pure function of the WCA's facts and
 * `resolveWcaPhaseAdvance` the single place that decides where a competition
 * belongs.
 *
 * Blocking a phase only removes it from the candidates — the sync still takes
 * the furthest phase left, so a later milestone (`announced`) moves the
 * competition on regardless and nothing stalls for good.
 *
 * Note this gates *entry*, not residence: it is checked when the sync is about
 * to move forward, so reopening a task after the competition has advanced does
 * not move it back. That matches `resolveWcaPhaseAdvance`, which only ever
 * moves forward.
 *
 * Phases that are not ahead of `currentPhaseId` are skipped without reading any
 * tasks: the sync could not move into them anyway, and this runs for every
 * linked competition on every sync.
 */
export async function resolveBlockedPhaseIds(
  ctx: StatusReadCtx,
  phases: readonly Doc<"phases">[],
  currentPhaseId: Id<"phases"> | null
): Promise<Set<Id<"phases">>> {
  const phaseByTemplateKey = new Map<string, Doc<"phases">>()
  for (const phase of phases) {
    if (phase.templateKey !== undefined) {
      phaseByTemplateKey.set(phase.templateKey, phase)
    }
  }

  const current =
    currentPhaseId === null
      ? null
      : (phases.find((phase) => phase._id === currentPhaseId) ?? null)

  const candidates = TEMPLATE.phases.flatMap((spec) => {
    const requires = spec.requiresPhaseComplete
    if (requires === undefined) return []

    // A phase this competition doesn't have can't be entered in the first
    // place, and one it has already reached can't be entered again.
    const target = phaseByTemplateKey.get(spec.key)
    if (target === undefined) return []
    if (current !== null && target.sortKey <= current.sortKey) return []

    // Nothing to finish — holding here would strand the competition instead.
    const required = phaseByTemplateKey.get(requires)
    if (required === undefined) return []

    return [{ targetId: target._id, requiredId: required._id }]
  })

  const blocked = new Set<Id<"phases">>()
  await Promise.all(
    candidates.map(async ({ targetId, requiredId }) => {
      if (!(await isPhaseComplete(ctx, requiredId))) blocked.add(targetId)
    })
  )

  return blocked
}
