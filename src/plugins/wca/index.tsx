import { GlobeIcon } from "lucide-react"
import type { IntegrationPlugin } from "@/plugins/integrations/registry"
import { LinkWcaCompetitionButton } from "@/plugins/wca/link-wca-competition-button"

export const wcaIntegrationPlugin: IntegrationPlugin = {
  id: "wca",
  competitionLink: "wcaCompetition",
  adminIcon: GlobeIcon,
  matchesResourceType: (type) => type === "wcaCompetition",
  resourceIcon: () => <GlobeIcon className="text-blue-600" />,
  resourceLabel: (data) =>
    data.resourceType === "wcaCompetition" ? data.name : "WCA",
  resourceHref: (data) =>
    data.resourceType === "wcaCompetition" ? data.url : undefined,
  LinkResourceAction: LinkWcaCompetitionButton,
  taskIntegrationIds: [],
  taskIntegrationCards: {},
}
