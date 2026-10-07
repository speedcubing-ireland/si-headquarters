import { v, type Infer } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { listPhasesForOwnerBounded } from "@/convex/phases/model"
import {
  getTemplateOrThrow,
  type CompetitionTemplateTaskSpec,
} from "@/convex/templates/registry"

// Shared by the one-off backfills that bring competitions created from an
// older version of the standard template in line with the current one.

export const STANDARD_TEMPLATE_KEY = "standard-competition"
const COMPLETED_PHASE_KEY = "completed"

export const backfillOutcomeValidator = v.object({
  competitionId: v.id("competitions"),
  /** Why nothing was changed. */
  reason: v.string(),
})

export type BackfillOutcome = Infer<typeof backfillOutcomeValidator>

/**
 * The competitions a backfill considers: every competition, or only
 * `competitionIds` when given. Ids that do not exist are reported in `skipped`.
 */
export async function loadBackfillCompetitions(
  ctx: MutationCtx,
  competitionIds: readonly Id<"competitions">[] | undefined,
  skipped: BackfillOutcome[]
): Promise<Doc<"competitions">[]> {
  const competitions: Doc<"competitions">[] = []
  if (competitionIds === undefined) {
    for await (const competition of ctx.db.query("competitions")) {
      competitions.push(competition)
    }
    return competitions
  }
  for (const competitionId of competitionIds) {
    const competition = await ctx.db.get("competitions", competitionId)
    if (competition === null) {
      skipped.push({ competitionId, reason: "competition not found" })
      continue
    }
    competitions.push(competition)
  }
  return competitions
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export function findTemplatePhase(key: string) {
  const template = getTemplateOrThrow(STANDARD_TEMPLATE_KEY)
  const phase = template.phases.find((candidate) => candidate.key === key)
  if (phase === undefined) {
    throw new Error(`Template phase "${key}" no longer exists.`)
  }
  return phase
}

/** Finds a task anywhere in a template phase, subtasks included. */
export function findTemplateTask(
  phase: ReturnType<typeof findTemplatePhase>,
  key: string
): CompetitionTemplateTaskSpec {
  const search = (
    tasks: readonly CompetitionTemplateTaskSpec[] | undefined
  ): CompetitionTemplateTaskSpec | undefined => {
    for (const task of tasks ?? []) {
      if (task.key === key) return task
      const found = search(task.subtasks)
      if (found !== undefined) return found
    }
    return undefined
  }
  const task = search(phase.tasks)
  if (task === undefined) {
    throw new Error(`Template task "${key}" no longer exists.`)
  }
  return task
}

/**
 * Matches a competition phase to a template phase.
 *
 * `templateKey` is only set on rows that `phases/wcaBackfill` already matched,
 * so older competitions still need the phase-name fallback. A renamed phase
 * stays unmatched on purpose rather than being guessed at.
 */
export function matchesTemplatePhase(
  phase: Doc<"phases">,
  templatePhase: { key: string; name: string }
): boolean {
  return (
    phase.templateKey === templatePhase.key ||
    (phase.templateKey === undefined &&
      normalizeName(phase.name) === normalizeName(templatePhase.name))
  )
}

/**
 * Loads a competition's phases and says why a backfill should leave it alone:
 * it is cancelled or already in its Completed phase. Null means it is in flight.
 */
export async function loadInFlightCompetitionPhases(
  ctx: MutationCtx,
  competition: Doc<"competitions">
): Promise<
  { phases: Doc<"phases">[]; skipReason: null } | { skipReason: string }
> {
  if (competition.cancelledAt !== undefined) {
    return { skipReason: "competition is cancelled" }
  }
  const phases = await listPhasesForOwnerBounded(ctx, {
    type: "competitions",
    id: competition._id,
  })
  const currentPhase =
    phases.find((phase) => phase._id === competition.phaseId) ?? null
  if (
    currentPhase !== null &&
    matchesTemplatePhase(currentPhase, findTemplatePhase(COMPLETED_PHASE_KEY))
  ) {
    return { skipReason: "competition is completed" }
  }
  return { phases, skipReason: null }
}
