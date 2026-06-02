import type { BackendIntegrationPlugin } from "@/convex/plugins/integrationTypes"
import { CANVA_PRESETS } from "@/convex/plugins/canva/presets"
import { runCanvaIntegration } from "@/convex/plugins/canva/runners"

export const canvaPlugin: BackendIntegrationPlugin = {
  id: "canva",
  service: "canva",
  taskIntegrations: CANVA_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    pluginId: "canva",
    requiredResources: [],
    run: runCanvaIntegration,
  })),
}
