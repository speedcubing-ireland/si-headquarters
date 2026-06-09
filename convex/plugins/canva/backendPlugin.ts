import { CANVA_PRESETS } from "@/convex/plugins/canva/presets"
import {
  CANVA_ENV_KEYS,
  canvaPluginDefinition,
} from "@/convex/plugins/canva/definition"
import { runCanvaIntegration } from "@/convex/plugins/canva/runners"
import type { BackendIntegrationPlugin } from "@/convex/plugins/core/integrationTypes"

const canvaRunners: NonNullable<
  BackendIntegrationPlugin["taskIntegrationRunners"]
> = {}

for (const preset of CANVA_PRESETS) {
  canvaRunners[preset.id] = runCanvaIntegration
}

export const canvaPlugin = {
  ...canvaPluginDefinition,
  env: CANVA_ENV_KEYS,
  taskIntegrationRunners: canvaRunners,
} satisfies BackendIntegrationPlugin
