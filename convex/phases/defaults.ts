// To-do this should be moved to the templating engine when that exists

import { generateNKeysBetween } from "fractional-indexing"

import type { PHASE_COLORS } from "./validators"

type PhaseColor = (typeof PHASE_COLORS)[number]

const DEFAULT_COMPETITION_PHASES = [
  { name: "Concept", color: "gray" },
  { name: "Pre-Announcement", color: "red" },
  { name: "Announced", color: "sky" },
  { name: "Pre-Competition", color: "amber" },
  { name: "Post-Competition", color: "green" },
  { name: "Completed", color: "gray" },
] satisfies Array<{ name: string; color: PhaseColor }>

const DEFAULT_COMPETITION_PHASE_SORT_KEYS = generateNKeysBetween(
  null,
  null,
  DEFAULT_COMPETITION_PHASES.length
)

export const defaultCompetitionPhases = DEFAULT_COMPETITION_PHASES.map(
  (phase, index) => ({
    ...phase,
    sortKey: DEFAULT_COMPETITION_PHASE_SORT_KEYS[index],
  })
)
