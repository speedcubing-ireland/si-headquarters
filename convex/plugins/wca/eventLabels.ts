// Shared by the frontend (re-exported from `src/lib/wca-events`) and backend
// emails, so both name and order events the same way.

/** The WCA's events, in the WCA's order. */
const WCA_EVENTS: readonly { id: string; label: string }[] = [
  { id: "222", label: "2x2x2 Cube" },
  { id: "333", label: "3x3x3 Cube" },
  { id: "444", label: "4x4x4 Cube" },
  { id: "555", label: "5x5x5 Cube" },
  { id: "666", label: "6x6x6 Cube" },
  { id: "777", label: "7x7x7 Cube" },
  { id: "333bf", label: "3x3x3 Blindfolded" },
  { id: "333fm", label: "3x3x3 Fewest Moves" },
  { id: "333oh", label: "3x3x3 One-Handed" },
  { id: "clock", label: "Clock" },
  { id: "minx", label: "Megaminx" },
  { id: "pyram", label: "Pyraminx" },
  { id: "skewb", label: "Skewb" },
  { id: "sq1", label: "Square-1" },
  { id: "444bf", label: "4x4x4 Blindfolded" },
  { id: "555bf", label: "5x5x5 Blindfolded" },
  { id: "333mbf", label: "3x3x3 Multi-Blind" },
]

const EVENTS_BY_ID = new Map(
  WCA_EVENTS.map((event, index) => [event.id, { ...event, index }])
)

/** An event's position in the WCA's event order; unknown events sort last. */
export function wcaEventOrder(eventId: string): number {
  return EVENTS_BY_ID.get(eventId)?.index ?? WCA_EVENTS.length
}

export function formatWcaEventLabel(eventId: string): string {
  return EVENTS_BY_ID.get(eventId)?.label ?? eventId.toUpperCase()
}
