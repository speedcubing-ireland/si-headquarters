export const LINKED_RESOURCE_TYPES = [
  "googleSheet",
  "wcaCompetition",
  "discordChannel",
] as const

export const INTEGRATION_SERVICES = [
  "google",
  "wca",
  "canva",
  "discord",
] as const

export const OAUTH_SERVICES = ["google", "wca", "canva"] as const

export type IntegrationServiceId = (typeof INTEGRATION_SERVICES)[number]
export type OAuthServiceId = (typeof OAUTH_SERVICES)[number]
export type PluginId = "sheets" | "wca" | "canva" | "discord" | "certificates"
export type LinkedResourceTypeId = (typeof LINKED_RESOURCE_TYPES)[number]

export const DEFAULT_RESOURCE_KEYS = {
  googleSheet: "default",
  wcaCompetition: "default",
  discordChannel: "default",
} as const satisfies Record<LinkedResourceTypeId, string>
