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

const WCA_EVENT_SHORT_LABELS: Record<string, string> = {
  "222": "2x2",
  "333": "3x3",
  "444": "4x4",
  "555": "5x5",
  "666": "6x6",
  "777": "7x7",
  "333bf": "3BLD",
  "333fm": "FMC",
  "333oh": "OH",
  clock: "Clock",
  minx: "Mega",
  pyram: "Pyra",
  skewb: "Skewb",
  sq1: "SQ-1",
  "444bf": "4BLD",
  "555bf": "5BLD",
  "333mbf": "MBLD",
}

export function formatWcaEventLabel(eventId: string): string {
  if (eventId in WCA_EVENT_LABELS) {
    return WCA_EVENT_LABELS[eventId]
  }
  return eventId.toUpperCase()
}

export function formatWcaEventShortLabel(eventId: string): string {
  if (eventId in WCA_EVENT_SHORT_LABELS) {
    return WCA_EVENT_SHORT_LABELS[eventId]
  }
  return formatWcaEventLabel(eventId)
}
