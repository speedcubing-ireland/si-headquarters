import type { RequiredStringConvexEnvName } from "@/convex/envTypes"
import {
  DEFAULT_RESOURCE_KEYS,
  type LinkedResourceTypeId,
  type PluginId,
} from "@/convex/integrations/constants"

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

export type TaskIntegrationStatusId = (typeof TASK_INTEGRATION_STATUSES)[number]
export type TaskIntegrationIdFromDefinitions =
  (typeof TASK_INTEGRATION_IDS)[number]

interface TaskIntegrationCatalogEntry {
  label: string
  pluginId: PluginId
  requiredResources: readonly {
    resourceType: LinkedResourceTypeId
    resourceKey: string
  }[]
  canva?: {
    sourceBrandTemplateEnv: RequiredStringConvexEnvName
    destinationFolderEnv: RequiredStringConvexEnvName
    naming: { outputSuffix: string }
  }
}

export const TASK_INTEGRATION_DEFINITIONS = {
  "sheet.transfer-schedule-to-wca": {
    label: "Transfer schedule to WCA",
    pluginId: "sheets",
    requiredResources: [
      {
        resourceType: "googleSheet",
        resourceKey: DEFAULT_RESOURCE_KEYS.googleSheet,
      },
      {
        resourceType: "wcaCompetition",
        resourceKey: DEFAULT_RESOURCE_KEYS.wcaCompetition,
      },
    ],
  },
  "sheet.populate-checkin": {
    label: "Populate check-in sheet",
    pluginId: "sheets",
    requiredResources: [
      {
        resourceType: "googleSheet",
        resourceKey: DEFAULT_RESOURCE_KEYS.googleSheet,
      },
      {
        resourceType: "wcaCompetition",
        resourceKey: DEFAULT_RESOURCE_KEYS.wcaCompetition,
      },
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
