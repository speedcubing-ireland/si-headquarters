import type { TaskIntegrationId } from "@/convex/plugins/core/types"

export interface CanvaPresetNaming {
  outputSuffix: string
}

export interface CanvaPreset {
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
    destinationFolderEnv: "CANVA_OUTPUT_FOLDER_ID",
    naming: { outputSuffix: "Certificates" },
  },
  {
    id: "canva.lanyards",
    label: "Lanyard designs",
    sourceBrandTemplateEnv: "CANVA_LANYARD_TEMPLATE_ID",
    destinationFolderEnv: "CANVA_OUTPUT_FOLDER_ID",
    naming: { outputSuffix: "Lanyards" },
  },
] as const satisfies readonly CanvaPreset[]

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

export function requireCanvaEnv(
  envKey: string,
  preset: CanvaPreset
): string {
  const value = process.env[envKey]
  if (value === undefined || value === "") {
    throw new Error(
      `Canva preset "${preset.id}" requires Convex env ${envKey} to be set.`
    )
  }
  return value
}

export function resolveCanvaPresetEnv(preset: CanvaPreset): {
  sourceBrandTemplateId: string
  destinationFolderId: string
} {
  return {
    sourceBrandTemplateId: requireCanvaEnv(
      preset.sourceBrandTemplateEnv,
      preset
    ),
    destinationFolderId: requireCanvaEnv(preset.destinationFolderEnv, preset),
  }
}

export function buildCanvaOutputTitle(
  competitionName: string,
  preset: CanvaPreset
): string {
  return `${competitionName} - ${preset.naming.outputSuffix}`
}
