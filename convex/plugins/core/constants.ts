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

export const MANUAL_TASK_INTEGRATION_STATUSES = [
  "awaiting_manual_share",
  "awaiting_manual_events_confirmation",
] as const satisfies readonly TaskIntegrationStatusId[]

export const INTEGRATION_SERVICES = [
  "google",
  "wca",
  "canva",
  "discord",
] as const

export const OAUTH_SERVICES = ["google", "wca", "canva"] as const

export type IntegrationServiceId = (typeof INTEGRATION_SERVICES)[number]
export type OAuthServiceId = (typeof OAUTH_SERVICES)[number]
export type PluginId = "sheets" | "wca" | "canva" | "discord"
export type CompetitionResourceTypeId =
  (typeof COMPETITION_RESOURCE_TYPES)[number]
export type TaskIntegrationStatusId = (typeof TASK_INTEGRATION_STATUSES)[number]
export type TaskIntegrationIdFromDefinitions =
  (typeof TASK_INTEGRATION_IDS)[number]

export const DEFAULT_RESOURCE_KEYS = {
  googleSheet: "default",
  wcaCompetition: "default",
  discordChannel: "default",
} as const satisfies Record<CompetitionResourceTypeId, string>

interface TaskIntegrationCatalogEntry {
  label: string
  pluginId: PluginId
  requiredResources: readonly {
    resourceType: CompetitionResourceTypeId
    resourceKey: string
  }[]
  canva?: {
    sourceBrandTemplateEnv: string
    destinationFolderEnv: string
    naming: { outputSuffix: string }
  }
}

export const TASK_INTEGRATION_DEFINITIONS = {
  "sheet.transfer-schedule-to-wca": {
    label: "Transfer schedule to WCA",
    pluginId: "sheets",
    requiredResources: [
      { resourceType: "googleSheet", resourceKey: "default" },
      { resourceType: "wcaCompetition", resourceKey: "default" },
    ],
  },
  "sheet.populate-checkin": {
    label: "Populate check-in sheet",
    pluginId: "sheets",
    requiredResources: [
      { resourceType: "googleSheet", resourceKey: "default" },
      { resourceType: "wcaCompetition", resourceKey: "default" },
    ],
  },
  "canva.certificates": {
    label: "Certificate designs",
    pluginId: "canva",
    requiredResources: [],
    canva: {
      sourceBrandTemplateEnv: "CANVA_CERT_TEMPLATE_ID",
      destinationFolderEnv: "CANVA_CERT_OUTPUT_FOLDER_ID",
      naming: { outputSuffix: "Certificates" },
    },
  },
  "canva.lanyards": {
    label: "Lanyard designs",
    pluginId: "canva",
    requiredResources: [],
    canva: {
      sourceBrandTemplateEnv: "CANVA_LANYARD_TEMPLATE_ID",
      destinationFolderEnv: "CANVA_LANYARD_OUTPUT_FOLDER_ID",
      naming: { outputSuffix: "Lanyards" },
    },
  },
} as const satisfies Record<
  TaskIntegrationIdFromDefinitions,
  TaskIntegrationCatalogEntry
>
