/**
 * Milestones a competition passes through, in the order they are reached. The
 * WCA has no single "status" field, so most of these are derived from the flags
 * and dates it does expose (see the WCA plugin's status sync). One rung,
 * `conceptTasksComplete`, additionally gates on our own task state, so the
 * ladder is "how far along a competition is", not purely "what the WCA says" —
 * the facts that are not the WCA's are passed into the evaluator as gates.
 *
 * The ladder is an *ordering*, not an implication: it says which milestone is
 * further along, which is what "furthest phase reached" needs. A reached set
 * may have gaps, because the WCA really does report a later milestone without
 * an earlier one. Where the real-world fact is conjunctive, a rung additionally
 * requires an earlier one — `held` requires `announced`,
 * `refundDeadlinePassed` requires `registrationClosed`, and
 * `conceptTasksComplete` requires `submitted` — but that is a property of those
 * facts, not a rule the ladder imposes on every rung.
 *
 * `cancelled` is deliberately *not* on the ladder — it is an orthogonal state
 * recorded on `competitions.cancelledAt` rather than a phase.
 */
export const WCA_MILESTONES = [
  "submitted",
  "conceptTasksComplete",
  "confirmed",
  "announced",
  "registrationClosed",
  "refundDeadlinePassed",
  "held",
  "resultsPosted",
] as const

export type WcaMilestone = (typeof WCA_MILESTONES)[number]

/** Position on the ladder. Lower means earlier in a competition's life. */
export function milestoneRank(milestone: WcaMilestone): number {
  return WCA_MILESTONES.indexOf(milestone)
}

/** Human-readable labels, shared by the admin config screen and notifications. */
export const WCA_MILESTONE_LABELS: Record<WcaMilestone, string> = {
  submitted: "Submitted to the WCA",
  conceptTasksComplete: "Concept tasks complete",
  confirmed: "Confirmed by the organiser",
  announced: "Announced (publicly visible)",
  registrationClosed: "Registration closed",
  refundDeadlinePassed: "Refund deadline passed",
  held: "Competition held",
  resultsPosted: "Results posted",
}

export const WCA_MILESTONE_DESCRIPTIONS: Record<WcaMilestone, string> = {
  submitted: "The competition exists on the WCA, in any state.",
  conceptTasksComplete:
    "The competition exists on the WCA and every task in its Concept phase is done, so the concept work is settled.",
  confirmed:
    "The organiser has confirmed the competition and it is awaiting announcement.",
  announced:
    "The WCA has announced the competition and it is publicly visible.",
  registrationClosed: "The competition's registration close date has passed.",
  refundDeadlinePassed:
    "Registration has closed and the competition's refund policy limit date has passed, so the competitor list is settled.",
  held: "The competition's end date has passed.",
  resultsPosted: "The WCA has posted the competition's results.",
}
