import { Dot } from "@/components/data-selectors/phase-selector"
import { Badge } from "@/components/ui/badge"
import {
  WCA_MILESTONE_DESCRIPTIONS,
  WCA_MILESTONE_LABELS,
  WCA_MILESTONES,
  type WcaMilestone,
} from "@/convex/phases/wcaMilestones"
import {
  standardCompetitionTemplate,
  type CompetitionTemplateDefinition,
  type CompetitionTemplateTaskSpec,
} from "@/convex/templates/registry"
import { Bullets, Note, Prose, Ui } from "@/features/help/help-prose"

/**
 * This section is generated from the same definitions the app runs on, rather
 * than written out by hand, so it cannot describe a ladder the product no
 * longer has. Adding a phase or a milestone updates the help page with it.
 *
 * Typed as the interface rather than the literal, matching `entryGates`, so the
 * optional fields read as optional here.
 */
const TEMPLATE: CompetitionTemplateDefinition = standardCompetitionTemplate

type TemplatePhase = CompetitionTemplateDefinition["phases"][number]

function countTasks(tasks: readonly CompetitionTemplateTaskSpec[]): number {
  return tasks.reduce(
    (total, task) => total + 1 + countTasks(task.subtasks ?? []),
    0
  )
}

function phaseByKey(key: string): TemplatePhase | undefined {
  return TEMPLATE.phases.find((phase) => phase.key === key)
}

function phaseForMilestone(milestone: WcaMilestone): TemplatePhase | undefined {
  return TEMPLATE.phases.find((phase) => phase.wcaMilestone === milestone)
}

function PhaseName({ phase }: { phase: TemplatePhase }) {
  return (
    <span className="inline-flex items-center gap-2 font-medium text-foreground">
      <Dot className="size-2" color={phase.color} />
      {phase.name}
    </span>
  )
}

export function PhaseLadder() {
  return (
    <Prose>
      <p>
        Competitions created from <Ui>{TEMPLATE.name}</Ui> move through these
        phases in order. Each one arrives with its own tasks already in place.
      </p>
      <ol className="flex flex-col gap-3">
        {TEMPLATE.phases.map((phase, index) => {
          const taskCount = countTasks(phase.tasks ?? [])
          const gate =
            phase.requiresPhaseComplete === undefined
              ? undefined
              : phaseByKey(phase.requiresPhaseComplete)

          return (
            <li
              key={phase.key}
              className="flex flex-col gap-1.5 rounded-lg border bg-card p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground/60 tabular-nums">
                  {index + 1}
                </span>
                <PhaseName phase={phase} />
                {phase.key === TEMPLATE.initialPhaseKey && (
                  <Badge variant="outline">Starts here</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {taskCount === 0
                    ? "No tasks of its own"
                    : `${String(taskCount)} tasks and subtasks`}
                </span>
              </div>
              {phase.wcaMilestone === undefined ? (
                <p className="text-sm">
                  Only a person can move a competition into this phase — the WCA
                  sync never targets it.
                </p>
              ) : (
                <p className="text-sm">
                  Reached when the competition is{" "}
                  <Ui>
                    {WCA_MILESTONE_LABELS[phase.wcaMilestone].toLowerCase()}
                  </Ui>{" "}
                  on the WCA.
                </p>
              )}
              {gate !== undefined && (
                <p className="text-sm">
                  The sync will not move a competition in here until everything
                  in <PhaseName phase={gate} /> is finished or cancelled.
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </Prose>
  )
}

export function MilestoneMapping() {
  return (
    <Prose>
      <p>
        The WCA has no single status field, so Headquarters works out where a
        competition has got to from the dates and flags the WCA does publish.
        Those are the milestones below, earliest first, each shown with the
        phase it moves a competition into.
      </p>
      <div className="flex flex-col gap-3">
        {WCA_MILESTONES.map((milestone) => {
          const phase = phaseForMilestone(milestone)

          return (
            <div
              key={milestone}
              className="grid gap-1 rounded-lg border bg-card p-3 sm:grid-cols-2 sm:gap-6"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {WCA_MILESTONE_LABELS[milestone]}
                </p>
                <p className="text-xs">
                  {WCA_MILESTONE_DESCRIPTIONS[milestone]}
                </p>
              </div>
              <p className="text-sm sm:self-center">
                {phase === undefined ? (
                  <span className="text-muted-foreground">
                    Does not move the competition on by itself.
                  </span>
                ) : (
                  <>
                    Moves the competition to <PhaseName phase={phase} />.
                  </>
                )}
              </p>
            </div>
          )
        })}
      </div>
      <Note>
        This is the mapping the template ships with. A director can change it in{" "}
        <Ui>Admin → WCA phases</Ui>, and if they have, what your competitions
        actually do will follow that instead.
      </Note>
    </Prose>
  )
}

export function WhyItDidNotMove() {
  return (
    <Prose>
      <p>
        If a competition is not in the phase you expected, it is almost always
        one of these:
      </p>
      <Bullets>
        <li>
          <Ui>The sync only ever moves forward.</Ui> It takes the furthest
          milestone the competition has reached and moves there. Reopening a
          task after a competition has advanced will not pull it back, and
          neither will anything else.
        </li>
        <li>
          <Ui>An earlier phase is still open.</Ui> Where a phase is gated, the
          sync holds off until the phase it depends on is completely settled.
          Finish or cancel the outstanding tasks and the next sync moves it on.
        </li>
        <li>
          <Ui>A later milestone jumped the queue.</Ui> The WCA genuinely reports
          a later milestone without an earlier one sometimes, and a blocked
          phase is skipped rather than waited on, so a competition can land
          further ahead than you expected. Nothing stalls permanently as a
          result.
        </li>
        <li>
          <Ui>Nothing maps to that phase.</Ui> Phases without a milestone are
          only ever set by a person, from <Ui>Edit phases</Ui> on the
          competition.
        </li>
      </Bullets>
      <p>
        Cancelling a competition is separate from all of this. It is recorded on
        the competition itself rather than as a phase, so a cancelled
        competition keeps whatever phase it had reached.
      </p>
      <p>
        You can always set the phase by hand. Gates constrain the sync, not
        people.
      </p>
    </Prose>
  )
}
