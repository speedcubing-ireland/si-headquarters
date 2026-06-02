export const COMPETITION_RESOURCE_TYPES = [
  "googleSheet",
  "wcaCompetition",
  "discordChannel",
] as const

export const TASK_INTEGRATION_IDS = [
  "sheet.transfer-schedule-to-wca",
  "sheet.populate-checkin",
  "canva.certificates",
  "canva.lanyards",
] as const

export const TASK_INTEGRATION_STATUSES = [
  "idle",
  "running",
  "awaiting_manual_share",
  "awaiting_manual_events_confirmation",
  "completed",
  "error",
] as const

export const INTEGRATION_SERVICES = [
  "google",
  "wca",
  "canva",
  "discord",
] as const

export const OAUTH_SERVICES = ["google", "wca", "canva"] as const

export const DEFAULT_RESOURCE_KEYS = {
  googleSheet: "default",
  wcaCompetition: "default",
  discordChannel: "default",
} as const satisfies Record<(typeof COMPETITION_RESOURCE_TYPES)[number], string>

