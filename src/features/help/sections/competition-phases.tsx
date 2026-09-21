import { useQuery } from "convex/react"
import type { ReactNode } from "react"
import { Dot } from "@/components/data-selectors/phase-selector"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import {
  WCA_MILESTONE_DESCRIPTIONS,
  WCA_MILESTONE_LABELS,
  WCA_MILESTONES,
} from "@/convex/phases/wcaMilestones"
import { Bullets, Note, Prose, Ui } from "@/features/help/help-prose"
import {
  countTasks,
  milestoneForPhase,
  milestoneTarget,
  personOnlyPhases,
  phaseByKey,
  TEMPLATE,
  type LiveMappings,
  type MilestoneTarget,
  type TemplatePhase,
} from "@/features/help/sections/competition-phase-model"

/**
 * Renders the phases section. What it knows — the template's ladder, and how a
 * live mapping resolves against it — lives in `competition-phase-model`; the
 * views take that as a prop so they can be tested without a Convex provider.
 */

/** `undefined` until the subscription delivers. */
function useEffectiveMapping() {
  return useQuery(api.phases.wcaMappingSettings.getEffective, {})
}

function PhaseName({ phase }: { phase: TemplatePhase }) {
  return (
    <span className="inline-flex items-center gap-2 font-medium text-foreground">
      <Dot className="size-2" color={phase.color} />
      {phase.name}
    </span>
  )
}

/** Phase names as part of a sentence: "Concept", "A and B", "A, B, and C". */
function PhaseList({ phases }: { phases: readonly TemplatePhase[] }) {
  return (
    <>
      {phases.map((phase, index) => (
        <span key={phase.key}>
          {index > 0 && (index === phases.length - 1 ? " and " : ", ")}
          <PhaseName phase={phase} />
        </span>
      ))}
    </>
  )
}

export function PhaseLadderView({ mappings }: { mappings: LiveMappings }) {
  return (
    <Prose>
      <p>
        Competitions created from <Ui>{TEMPLATE.name}</Ui> move through these
        phases in order. Each one arrives with its own tasks already in place.
      </p>
      <p>
        Which WCA milestone reaches each phase is whatever this deployment is
        configured to do, and is read from the app as you look at it. Phases are
        named as the template creates them — a particular competition's phases
        may have been renamed since.
      </p>
      <ol className="flex flex-col gap-3">
        {TEMPLATE.phases.map((phase, index) => {
          const taskCount = countTasks(phase.tasks ?? [])
          const gate =
            phase.requiresPhaseComplete === undefined
              ? undefined
              : phaseByKey(phase.requiresPhaseComplete)
          const milestone =
            mappings === undefined
              ? undefined
              : milestoneForPhase(mappings, phase.key)

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
              {mappings === undefined ? (
                <Skeleton className="h-4 w-64" />
              ) : milestone === undefined ? (
                <p className="text-sm">
                  No WCA milestone moves a competition into this phase, so only
                  a person can.
                </p>
              ) : (
                <p className="text-sm">
                  Reached when the competition is{" "}
                  <Ui>{WCA_MILESTONE_LABELS[milestone].toLowerCase()}</Ui> on
                  the WCA.
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

export function PhaseLadder() {
  const settings = useEffectiveMapping()

  return <PhaseLadderView mappings={settings?.mappings} />
}

function MilestoneOutcome({ target }: { target: MilestoneTarget }): ReactNode {
  switch (target.kind) {
    case "unmapped":
      return (
        <span className="text-muted-foreground">
          Does not move the competition on by itself.
        </span>
      )
    case "missing":
      return (
        <span className="text-muted-foreground">
          Set to a phase this template no longer has, so it moves nothing. A
          director should pick a phase again in <Ui>Admin → WCA phases</Ui>.
        </span>
      )
    case "phase":
      return (
        <>
          Moves the competition to <PhaseName phase={target.phase} />.
        </>
      )
  }
}

export function MilestoneMappingView({
  mappings,
  isCustomised,
}: {
  mappings: LiveMappings
  isCustomised: boolean | undefined
}) {
  return (
    <Prose>
      <p>
        The WCA has no single status field, so Headquarters works out where a
        competition has got to from the dates and flags the WCA does publish.
        Those are the milestones below, earliest first, each shown with the
        phase it moves a competition into.
      </p>
      <div className="flex flex-col gap-3">
        {WCA_MILESTONES.map((milestone) => (
          <div
            key={milestone}
            className="grid gap-1 rounded-lg border bg-card p-3 sm:grid-cols-2 sm:gap-6"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {WCA_MILESTONE_LABELS[milestone]}
              </p>
              <p className="text-xs">{WCA_MILESTONE_DESCRIPTIONS[milestone]}</p>
            </div>
            {mappings === undefined ? (
              <Skeleton className="h-4 w-48 sm:self-center" />
            ) : (
              <p className="text-sm sm:self-center">
                <MilestoneOutcome
                  target={milestoneTarget(mappings, milestone)}
                />
              </p>
            )}
          </div>
        ))}
      </div>
      <Note>
        This is the mapping your organisation actually runs on, read from the
        app as you look at it.{" "}
        {isCustomised === undefined ? null : isCustomised ? (
          <>
            A director has saved it in <Ui>Admin → WCA phases</Ui>, so it may
            differ from the one the template ships with.
          </>
        ) : (
          <>
            Nothing has been saved over it, so it is the mapping the template
            ships with. A director can change it in <Ui>Admin → WCA phases</Ui>,
            and this page will follow.
          </>
        )}
      </Note>
    </Prose>
  )
}

export function MilestoneMapping() {
  const settings = useEffectiveMapping()

  return (
    <MilestoneMappingView
      mappings={settings?.mappings}
      isCustomised={settings?.isCustomised}
    />
  )
}

export function WhyItDidNotMoveView({ mappings }: { mappings: LiveMappings }) {
  const personOnly = mappings === undefined ? [] : personOnlyPhases(mappings)

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
        {personOnly.length > 0 && (
          <li>
            <Ui>Nothing maps to that phase.</Ui> No milestone currently reaches{" "}
            <PhaseList phases={personOnly} />, so only a person moves a
            competition into {personOnly.length === 1 ? "it" : "them"}, from{" "}
            <Ui>Edit phases</Ui> on the competition.
          </li>
        )}
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

export function WhyItDidNotMove() {
  const settings = useEffectiveMapping()

  return <WhyItDidNotMoveView mappings={settings?.mappings} />
}
