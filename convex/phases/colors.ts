export const PHASE_COLORS = [
  "gray",
  "slate",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const

export type PhaseColor = (typeof PHASE_COLORS)[number]

const PHASE_COLOR_SET: ReadonlySet<string> = new Set(PHASE_COLORS)

export function isPhaseColor(value: string): value is PhaseColor {
  return PHASE_COLOR_SET.has(value)
}
