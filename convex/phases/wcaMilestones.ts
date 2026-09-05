/**
 * Milestones a competition passes through on the WCA, in the order they are
 * reached. The WCA has no single "status" field, so these are derived from the
 * flags and dates it does expose (see the WCA plugin's status sync).
 *
 * The ladder is monotonic: reaching a milestone implies every earlier one has
 * been reached too. `cancelled` is deliberately *not* on the ladder — it is an
 * orthogonal state recorded on `competitions.cancelledAt` rather than a phase.
 */
export const WCA_MILESTONES = [
  "submitted",
  "confirmed",
  "announced",
  "registrationClosed",
  "held",
  "resultsPosted",
] as const

export type WcaMilestone = (typeof WCA_MILESTONES)[number]

const WCA_MILESTONE_SET: ReadonlySet<string> = new Set(WCA_MILESTONES)

export function isWcaMilestone(value: string): value is WcaMilestone {
  return WCA_MILESTONE_SET.has(value)
}

/** Position on the ladder. Lower means earlier in a competition's life. */
export function milestoneRank(milestone: WcaMilestone): number {
  return WCA_MILESTONES.indexOf(milestone)
}

/** Human-readable labels, shared by the admin config screen and notifications. */
export const WCA_MILESTONE_LABELS: Record<WcaMilestone, string> = {
  submitted: "Submitted to the WCA",
  confirmed: "Confirmed by the organiser",
  announced: "Announced (publicly visible)",
  registrationClosed: "Registration closed",
  held: "Competition held",
  resultsPosted: "Results posted",
}

export const WCA_MILESTONE_DESCRIPTIONS: Record<WcaMilestone, string> = {
  submitted: "The competition exists on the WCA, in any state.",
  confirmed:
    "The organiser has confirmed the competition and it is awaiting announcement.",
  announced:
    "The WCA has announced the competition and it is publicly visible.",
  registrationClosed: "The competition's registration close date has passed.",
  held: "The competition's end date has passed.",
  resultsPosted: "The WCA has posted the competition's results.",
}
