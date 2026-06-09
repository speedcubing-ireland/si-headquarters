import type { BlockerCounts } from "@/convex/tasks/blockers/counts"

export function formatBlockedByTooltip(blockedBy: BlockerCounts["blockedBy"]) {
  const openBlockers = blockedBy.filter((entry) => entry.isOpen)
  if (openBlockers.length === 0) return ""

  const names = openBlockers.map((entry) => entry.name)
  if (names.length === 1) {
    return `Blocked by ${names[0]}`
  }

  return `Blocked by ${names.join(", ")}`
}
