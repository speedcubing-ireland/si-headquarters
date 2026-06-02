import { PaletteIcon } from "lucide-react"
import { CanvaTaskCard } from "@/plugins/canva/canva-task-card"
import type { IntegrationPlugin } from "@/plugins/integrations/registry"

export const canvaIntegrationPlugin = {
  id: "canva",
  adminIcon: PaletteIcon,
  matchesResourceType: () => false,
  resourceIcon: () => <PaletteIcon className="text-pink-500" />,
  resourceLabel: () => "Canva",
  resourceHref: () => undefined,
  taskIntegrationIds: ["canva.certificates", "canva.lanyards"],
  DefaultTaskIntegrationCard: CanvaTaskCard,
} satisfies IntegrationPlugin
