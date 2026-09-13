import type { Doc, Id } from "@/convex/_generated/dataModel"
import {
  buildTaskStatusView,
  TaskStatusLoader,
  type StatusReadCtx,
} from "@/convex/tasks/status/resolver"
import { getProgress } from "@/convex/tasks/status/rules"
import { CONCEPT_PHASE_KEY } from "@/convex/templates/registry"

/**
 * The milestone inputs that are ours rather than the WCA's.
 *
 * `reachedMilestones` is pure and Convex-free so it can be unit-tested
 * directly, but one rung of the ladder gates on our own task state. Resolving
 * that here keeps the evaluator pure: the caller reads the database, this turns
 * what it read into plain booleans, and the evaluator combines them with the
 * WCA's facts.
 */
export interface MilestoneGates {
  /** Every task in the competition's Concept phase is done or cancelled. */
  conceptTasksComplete: boolean
}

/**
 * Whether every task directly under a phase is complete.
 *
 * "Complete" is the codebase's existing definition — `done` or `cancelled`
 * (`isTerminalComplete`) — so a cancelled task does not hold the phase open.
 * Only direct children are counted because a parent task's `effectiveStatus`
 * already folds in its subtasks: a parent with outstanding children resolves to
 * `in-progress`, never `done`.
 *
 * A phase with no tasks is complete, matching `getProgress([])`.
 */
async function isPhaseComplete(
  ctx: StatusReadCtx,
  phaseId: Id<"phases">
): Promise<boolean> {
  const loader = new TaskStatusLoader(ctx)
  const tasks = await loader.getPhaseTasks(phaseId)
  const views = await Promise.all(
    tasks.map((task) => buildTaskStatusView(loader, task))
  )
  const progress = getProgress(views.map((view) => view.effectiveStatus))
  return progress.incomplete === 0
}

/**
 * Resolves the non-WCA milestone inputs for a competition, from the phases the
 * caller has already loaded.
 *
 * A competition with no Concept phase — one built without it, one whose
 * Concept phase was deleted, or one whose phases were created by hand — counts
 * as complete. There is nothing to finish, and holding instead would stall such
 * a competition short of Pre-Announcement until the WCA announced it.
 */
export async function resolveMilestoneGates(
  ctx: StatusReadCtx,
  phases: readonly Doc<"phases">[]
): Promise<MilestoneGates> {
  const concept = phases.find((p) => p.templateKey === CONCEPT_PHASE_KEY)
  return {
    conceptTasksComplete:
      concept === undefined ? true : await isPhaseComplete(ctx, concept._id),
  }
}
