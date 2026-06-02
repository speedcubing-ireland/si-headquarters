import type { TaskIntegrationId } from "@/convex/plugins/core/types"
import { env } from "@/convex/_generated/server"

export interface CanvaPresetNaming {
  outputSuffix: string
}

interface CanvaPresetDefinition {
  id: TaskIntegrationId
  label: string
  sourceBrandTemplateEnv: string
  destinationFolderEnv: string
  naming: CanvaPresetNaming
}

export const CANVA_PRESETS = [
  {
    id: "canva.certificates",
    label: "Certificate designs",
    sourceBrandTemplateEnv: "CANVA_CERT_TEMPLATE_ID",
    destinationFolderEnv: "CANVA_CERT_OUTPUT_FOLDER_ID",
    naming: { outputSuffix: "Certificates" },
  },
  {
    id: "canva.lanyards",
    label: "Lanyard designs",
    sourceBrandTemplateEnv: "CANVA_LANYARD_TEMPLATE_ID",
    destinationFolderEnv: "CANVA_LANYARD_OUTPUT_FOLDER_ID",
    naming: { outputSuffix: "Lanyards" },
  },
] as const satisfies readonly CanvaPresetDefinition[]

export type CanvaPreset = (typeof CANVA_PRESETS)[number]
export type CanvaPresetId = (typeof CANVA_PRESETS)[number]["id"]
export type CanvaEnvKey =
  | (typeof CANVA_PRESETS)[number]["sourceBrandTemplateEnv"]
  | (typeof CANVA_PRESETS)[number]["destinationFolderEnv"]

export type CanvaEnvSource = Record<CanvaEnvKey, string | undefined>

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
  const value = source[envKey]
  if (value === undefined || value === "") {
    throw new Error(
      `Canva preset "${preset.id}" requires Convex env ${envKey} to be set.`
    )
  }
  return value
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
