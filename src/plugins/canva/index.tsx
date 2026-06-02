import { PaletteIcon } from "lucide-react"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { CANVA_PRESETS } from "@/convex/plugins/canva/presets"
import { CanvaTaskCard } from "@/plugins/canva/canva-task-card"
import type { IntegrationPlugin } from "@/plugins/integrations/registry"

interface TaskIntegrationCardProps {
  row: Doc<"taskIntegrations">
  taskId: Id<"tasks">
}

const canvaTaskIntegrationCards = Object.fromEntries(
  CANVA_PRESETS.map((preset) => [
    preset.id,
    (props: TaskIntegrationCardProps) => (
      <CanvaTaskCard title={preset.label} {...props} />
    ),
  ])
) satisfies IntegrationPlugin["taskIntegrationCards"]

export const canvaIntegrationPlugin: IntegrationPlugin = {
  id: "canva",
  adminIcon: PaletteIcon,
  matchesResourceType: () => false,
  resourceIcon: () => <PaletteIcon className="text-pink-500" />,
  resourceLabel: () => "Canva",
  resourceHref: () => undefined,
  taskIntegrationIds: CANVA_PRESETS.map((preset) => preset.id),
  taskIntegrationCards: canvaTaskIntegrationCards,
}
