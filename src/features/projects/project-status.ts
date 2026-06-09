import { isProjectStatus, type ProjectStatus } from "@/convex/projects/statuses"

export function isProjectStatusTab(
  value: string
): value is ProjectStatus | "all" {
  return value === "all" || isProjectStatus(value)
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  complete: "Complete",
  cancelled: "Cancelled",
}

export const PROJECT_STATUS_TABS: (ProjectStatus | "all")[] = [
  "all",
  "planning",
  "active",
  "paused",
  "complete",
  "cancelled",
]
