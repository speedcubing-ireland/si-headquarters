import { SETTINGS_LOCATION } from "@/convex/settings/model"
import type {
  CanvaPresetSettings,
  CanvaSettingsPresetKey,
} from "@/convex/settings/validators"
import {
  TASK_INTEGRATION_DEFINITIONS,
  type TaskIntegrationIdFromDefinitions,
} from "@/convex/integrations/taskIntegrations/constants"

const CANVA_PRESET_IDS = [
  "canva.certificates",
  "canva.lanyards",
] as const satisfies readonly TaskIntegrationIdFromDefinitions[]

export interface CanvaPreset {
  id: (typeof CANVA_PRESET_IDS)[number]
  label: string
  settingsKey: CanvaSettingsPresetKey
  naming: { outputSuffix: string }
}

export const CANVA_PRESETS = CANVA_PRESET_IDS.map((id) => {
  const definition = TASK_INTEGRATION_DEFINITIONS[id]
  return {
    id,
    label: definition.label,
    settingsKey: definition.canva.settingsKey,
    naming: definition.canva.naming,
  }
}) satisfies readonly CanvaPreset[]

export type CanvaPresetId = (typeof CANVA_PRESETS)[number]["id"]

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

/**
 * The preset's template and output folder from Admin → Settings, or a clear
 * error naming where to configure them.
 */
export function requireCanvaPresetSettings(
  preset: CanvaPreset,
  settings: CanvaPresetSettings | null
): {
  sourceBrandTemplateId: string
  destinationFolderId: string
} {
  if (settings === null) {
    throw new Error(
      `Canva preset "${preset.id}" has no brand template or output folder. Configure them in ${SETTINGS_LOCATION}.`
    )
  }
  return {
    sourceBrandTemplateId: settings.brandTemplateId,
    destinationFolderId: settings.outputFolderId,
  }
}

export function buildCanvaOutputTitle(
  competitionName: string,
  preset: CanvaPreset
): string {
  return `${competitionName} - ${preset.naming.outputSuffix}`
}
