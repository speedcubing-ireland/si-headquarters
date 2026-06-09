export const PROJECT_STATUSES = [
  "planning",
  "active",
  "paused",
  "complete",
  "cancelled",
] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

const PROJECT_STATUS_SET: ReadonlySet<string> = new Set(PROJECT_STATUSES)

export function isProjectStatus(value: string): value is ProjectStatus {
  return PROJECT_STATUS_SET.has(value)
}
