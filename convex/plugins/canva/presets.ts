import { env } from "@/convex/_generated/server"
import { requireConvexEnv, type ConvexEnvSource } from "@/convex/envTypes"
import {
  TASK_INTEGRATION_DEFINITIONS,
  type TaskIntegrationIdFromDefinitions,
} from "@/convex/plugins/core/constants"

const CANVA_PRESET_IDS = [
  "canva.certificates",
  "canva.lanyards",
] as const satisfies readonly TaskIntegrationIdFromDefinitions[]

type CanvaPresetDefinition =
  (typeof TASK_INTEGRATION_DEFINITIONS)[(typeof CANVA_PRESET_IDS)[number]]

export type CanvaEnvKey =
  | CanvaPresetDefinition["canva"]["sourceBrandTemplateEnv"]
  | CanvaPresetDefinition["canva"]["destinationFolderEnv"]

export interface CanvaPreset {
  id: (typeof CANVA_PRESET_IDS)[number]
  label: string
  sourceBrandTemplateEnv: CanvaEnvKey
  destinationFolderEnv: CanvaEnvKey
  naming: { outputSuffix: string }
}

export const CANVA_PRESETS = CANVA_PRESET_IDS.map((id) => {
  const definition = TASK_INTEGRATION_DEFINITIONS[id]
  return {
    id,
    label: definition.label,
    sourceBrandTemplateEnv: definition.canva.sourceBrandTemplateEnv,
    destinationFolderEnv: definition.canva.destinationFolderEnv,
    naming: definition.canva.naming,
  }
}) satisfies readonly CanvaPreset[]

export type CanvaPresetId = (typeof CANVA_PRESETS)[number]["id"]

export type CanvaEnvSource = ConvexEnvSource<CanvaEnvKey>

const presetById = new Map<string, CanvaPreset>(
  CANVA_PRESETS.map((preset) => [preset.id, preset])
)

export function getCanvaPreset(integrationId: string): CanvaPreset {
  const preset = presetById.get(integrationId)
  if (preset === undefined) {
    throw new Error(`Unknown Canva integration: ${integrationId}`)
  }
  return preset
}

export function requireCanvaEnv(
  envKey: CanvaEnvKey,
  preset: CanvaPreset,
  source: CanvaEnvSource = env
): string {
  return requireConvexEnv(
    envKey,
    `Canva preset "${preset.id}" requires Convex env ${envKey} to be set.`,
    source
  )
}

export function resolveCanvaPresetEnv(
  preset: CanvaPreset,
  source?: CanvaEnvSource
): {
  sourceBrandTemplateId: string
  destinationFolderId: string
} {
  return {
    sourceBrandTemplateId: requireCanvaEnv(
      preset.sourceBrandTemplateEnv,
      preset,
      source
    ),
    destinationFolderId: requireCanvaEnv(
      preset.destinationFolderEnv,
      preset,
      source
    ),
  }
}

export function buildCanvaOutputTitle(
  competitionName: string,
  preset: CanvaPreset
): string {
  return `${competitionName} - ${preset.naming.outputSuffix}`
}
