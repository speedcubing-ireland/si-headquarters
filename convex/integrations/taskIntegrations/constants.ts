import type { StringConvexEnvName } from "@/convex/envTypes"
import {
  DEFAULT_RESOURCE_KEYS,
  type LinkedResourceTypeId,
  type PluginId,
} from "@/convex/integrations/constants"

export const TASK_INTEGRATION_IDS = [
  "sheet.transfer-schedule-to-wca",
  "canva.certificates",
  "canva.lanyards",
  "wca.achievements-badges",
] as const

/**
 * Integration ids that can no longer be attached or run but may still be
 * stored on old tasks. Only the `taskIntegrations` table accepts them; queries
 * filter them out. `templates/badgesReadyBackfill` deletes the remaining rows,
 * after which an id can be dropped from this list.
 */
export const LEGACY_TASK_INTEGRATION_IDS = ["sheet.populate-checkin"] as const

/**
 * How a task integration is used: `run` integrations do work through their
 * plugin's runner, `link` integrations only point somewhere and have no runner.
 */
export const TASK_INTEGRATION_KINDS = ["run", "link"] as const
export type TaskIntegrationKind = (typeof TASK_INTEGRATION_KINDS)[number]

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
  kind: TaskIntegrationKind
  requiredResources: readonly {
    resourceType: LinkedResourceTypeId
    resourceKey: string
  }[]
  canva?: {
    sourceBrandTemplateEnv: StringConvexEnvName
    destinationFolderEnv: StringConvexEnvName
    naming: { outputSuffix: string }
  }
}

export const TASK_INTEGRATION_DEFINITIONS = {
  "sheet.transfer-schedule-to-wca": {
    label: "Transfer schedule to WCA",
    pluginId: "sheets",
    kind: "run",
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
    kind: "run",
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
    kind: "run",
    requiredResources: [],
    canva: {
      sourceBrandTemplateEnv: "CANVA_LANYARD_TEMPLATE_ID",
      destinationFolderEnv: "CANVA_LANYARD_OUTPUT_FOLDER_ID",
      naming: { outputSuffix: "Lanyards" },
    },
  },
  "wca.achievements-badges": {
    label: "SI Achievements badges",
    pluginId: "wca",
    kind: "link",
    requiredResources: [],
  },
} as const satisfies Record<
  TaskIntegrationIdFromDefinitions,
  TaskIntegrationCatalogEntry
>
