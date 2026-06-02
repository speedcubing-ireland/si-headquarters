import { CANVA_PRESETS } from "@/convex/plugins/canva/presets"
import { runCanvaIntegration } from "@/convex/plugins/canva/runners"
import type { BackendIntegrationPlugin } from "@/convex/plugins/core/integrationTypes"

const canvaEnv = Array.from(
  new Set(
    CANVA_PRESETS.flatMap((preset) => [
      preset.sourceBrandTemplateEnv,
      preset.destinationFolderEnv,
    ])
  )
)

const canvaRunners: NonNullable<
  BackendIntegrationPlugin["taskIntegrationRunners"]
> = {}

for (const preset of CANVA_PRESETS) {
  canvaRunners[preset.id] = runCanvaIntegration
}

export const canvaPlugin = {
  id: "canva",
  service: "canva",
  env: canvaEnv,
  taskIntegrationRunners: canvaRunners,
} satisfies BackendIntegrationPlugin
