import { formatWcaEventLabel } from "@/convex/plugins/wca/eventLabels"

export {
  formatWcaEventLabel,
  WCA_EVENT_LABELS,
} from "@/convex/plugins/wca/eventLabels"

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

export function formatWcaEventShortLabel(eventId: string): string {
  if (eventId in WCA_EVENT_SHORT_LABELS) {
    return WCA_EVENT_SHORT_LABELS[eventId]
  }
  return formatWcaEventLabel(eventId)
}
