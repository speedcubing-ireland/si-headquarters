import type { FunctionReturnType } from "convex/server"
import type { api } from "@/convex/_generated/api"
import type { WcaMilestone } from "@/convex/phases/wcaMilestones"
import {
  standardCompetitionTemplate,
  type CompetitionTemplateDefinition,
  type CompetitionTemplateTaskSpec,
} from "@/convex/templates/registry"

/**
 * What the phases help section knows, separated from how it renders.
 *
 * The ladder's *structure* comes from the competition template, because that is
 * where it genuinely lives: which phases exist, their order, names, colours,
 * entry gates, and the tasks they arrive with are all code, changed only by a
 * deploy.
 *
 * Which WCA milestone reaches each phase is not. That mapping is stored in the
 * database and a director can change it, so it is read live and passed in here
 * — otherwise the page confidently describes a ladder the deployment reading it
 * does not have.
 *
 * Typed as the interface rather than the literal, matching `entryGates`, so the
 * optional fields read as optional here.
 */
export const TEMPLATE: CompetitionTemplateDefinition =
  standardCompetitionTemplate

export type TemplatePhase = CompetitionTemplateDefinition["phases"][number]

type MappingSettings = FunctionReturnType<
  typeof api.phases.wcaMappingSettings.getEffective
>

/** One entry per milestone, in ladder order. `undefined` while loading. */
export type LiveMappings = MappingSettings["mappings"] | undefined

export function countTasks(
  tasks: readonly CompetitionTemplateTaskSpec[]
): number {
  return tasks.reduce(
    (total, task) => total + 1 + countTasks(task.subtasks ?? []),
    0
  )
}

export function phaseByKey(key: string): TemplatePhase | undefined {
  return TEMPLATE.phases.find((phase) => phase.key === key)
}

/**
 * The phase that must be settled before the sync will move a competition into
 * this one (`requiresPhaseComplete`). A fact about the template rather than
 * the mapping, so it holds whichever milestone is pointed at the phase.
 *
 * Worth stating wherever the phase is described as reachable: a gate is not a
 * queue. `resolveBlockedPhaseIds` drops a blocked phase from the candidates
 * and the sync takes the furthest one left, so a competition whose later
 * milestones have landed passes the gated phase by rather than waiting at it.
 */
export function phaseGate(phase: TemplatePhase): TemplatePhase | undefined {
  return phase.requiresPhaseComplete === undefined
    ? undefined
    : phaseByKey(phase.requiresPhaseComplete)
}

/**
 * Where a milestone sends a competition.
 *
 * Three outcomes, deliberately distinct: the milestone moves nothing, it moves
 * a competition to a phase we can name, or it names a phase this template no
 * longer has. The last is a real misconfiguration — `assertMappingsValid` only
 * runs when a mapping is saved, so a row stored against an older template can
 * outlive the phase it points at — and collapsing it into "unmapped" would hide
 * it from the one screen meant to explain the mapping.
 */
export type MilestoneTarget =
  | { kind: "unmapped" }
  | { kind: "phase"; phase: TemplatePhase }
  | { kind: "missing"; phaseKey: string }

export function milestoneTarget(
  mappings: NonNullable<LiveMappings>,
  milestone: WcaMilestone
): MilestoneTarget {
  const phaseKey =
    mappings.find((mapping) => mapping.milestone === milestone)?.phaseKey ??
    null
  if (phaseKey === null) {
    return { kind: "unmapped" }
  }

  const phase = phaseByKey(phaseKey)

  return phase === undefined
    ? { kind: "missing", phaseKey }
    : { kind: "phase", phase }
}

/**
 * The milestone that reaches a phase. `assertMappingsValid` allows a phase to
 * back at most one milestone, so "the" is accurate rather than a simplification.
 */
export function milestoneForPhase(
  mappings: NonNullable<LiveMappings>,
  phaseKey: string
): WcaMilestone | undefined {
  return mappings.find((mapping) => mapping.phaseKey === phaseKey)?.milestone
}

/** Template phases no milestone advances to — only a person moves these. */
export function personOnlyPhases(
  mappings: NonNullable<LiveMappings>
): TemplatePhase[] {
  return TEMPLATE.phases.filter(
    (phase) => milestoneForPhase(mappings, phase.key) === undefined
  )
}
