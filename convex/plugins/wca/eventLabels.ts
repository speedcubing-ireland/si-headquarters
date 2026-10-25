// Shared by the frontend (re-exported from `src/lib/wca-events`) and backend
// emails, so both name events the same way.
export const WCA_EVENT_LABELS: Record<string, string> = {
  "222": "2x2x2 Cube",
  "333": "3x3x3 Cube",
  "444": "4x4x4 Cube",
  "555": "5x5x5 Cube",
  "666": "6x6x6 Cube",
  "777": "7x7x7 Cube",
  "333bf": "3x3x3 Blindfolded",
  "333fm": "3x3x3 Fewest Moves",
  "333oh": "3x3x3 One-Handed",
  clock: "Clock",
  minx: "Megaminx",
  pyram: "Pyraminx",
  skewb: "Skewb",
  sq1: "Square-1",
  "444bf": "4x4x4 Blindfolded",
  "555bf": "5x5x5 Blindfolded",
  "333mbf": "3x3x3 Multi-Blind",
}

/** The order events are listed in, for sorting results consistently. */
export const WCA_EVENT_ORDER: readonly string[] = [
  "222",
  "333",
  "444",
  "555",
  "666",
  "777",
  "333bf",
  "333fm",
  "333oh",
  "clock",
  "minx",
  "pyram",
  "skewb",
  "sq1",
  "444bf",
  "555bf",
  "333mbf",
]

export function formatWcaEventLabel(eventId: string): string {
  if (eventId in WCA_EVENT_LABELS) {
    return WCA_EVENT_LABELS[eventId]
  }
  return eventId.toUpperCase()
}
