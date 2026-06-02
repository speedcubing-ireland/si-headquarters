import type { BackendIntegrationPlugin } from "@/convex/plugins/integrationTypes"
import { CANVA_PRESETS } from "@/convex/plugins/canva/presets"
import { runCanvaIntegration } from "@/convex/plugins/canva/runners"

const canvaEnv = Array.from(
  new Set(
    CANVA_PRESETS.flatMap((preset) => [
      preset.sourceBrandTemplateEnv,
      preset.destinationFolderEnv,
    ])
  )
)

export const canvaPlugin: BackendIntegrationPlugin = {
  id: "canva",
  service: "canva",
  env: canvaEnv,
  taskIntegrations: CANVA_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    pluginId: "canva",
    requiredResources: [],
    run: runCanvaIntegration,
  })),
}
