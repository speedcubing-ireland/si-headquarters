import type { Doc, Id } from "@/convex/_generated/dataModel"

/**
 * Whether the WCA has cancelled this competition.
 *
 * The single definition of "is this competition still live work?". Every reader
 * that filters cancelled competitions out — the home dashboard, the overdue
 * scan — goes through this rather than re-spelling the field test, so a change
 * to how cancellation is recorded has one place to land.
 *
 * The calendar deliberately still *shows* cancelled competitions, struck
 * through, which is why this is a predicate rather than a filtered query.
 */
export function isCompetitionCancelled(
  competition: Pick<Doc<"competitions">, "cancelledAt">
): boolean {
  return competition.cancelledAt !== undefined
}

/**
 * Template key of the competition template's final phase (see
 * `standardCompetitionTemplate`). Phases can be renamed, so the key — not the
 * name — is what marks a competition as finished.
 */
const COMPLETED_PHASE_TEMPLATE_KEY = "completed"

/**
 * Whether this competition has reached its final, "Completed" phase.
 *
 * Readers that only care about live work (the home dashboard) skip completed
 * competitions entirely, together with cancelled ones, so their cost scales
 * with the competitions still in flight rather than every competition ever
 * run.
 */
export function isCompetitionComplete(
  competition: Pick<Doc<"competitions">, "phaseId">,
  phaseById: Map<Id<"phases">, Pick<Doc<"phases">, "templateKey">>
): boolean {
  if (competition.phaseId === null) return false
  return (
    phaseById.get(competition.phaseId)?.templateKey ===
    COMPLETED_PHASE_TEMPLATE_KEY
  )
}
