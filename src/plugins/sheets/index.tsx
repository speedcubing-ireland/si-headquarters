import { FileSpreadsheetIcon } from "lucide-react"
import type { IntegrationPlugin } from "@/plugins/integrations/registry"
import { LinkGoogleSheetButton } from "@/plugins/sheets/link-google-sheet-button"
import { PopulateCheckinCard } from "@/plugins/sheets/populate-checkin-card"
import { TransferScheduleCard } from "@/plugins/sheets/transfer-schedule-card"

export const sheetsIntegrationPlugin: IntegrationPlugin = {
  id: "sheets",
  competitionLink: "googleSheet",
  adminIcon: FileSpreadsheetIcon,
  matchesResourceType: (type) => type === "googleSheet",
  resourceIcon: () => <FileSpreadsheetIcon className="text-lime-500" />,
  resourceLabel: (data) =>
    data.resourceType === "googleSheet" ? data.title : "Sheet",
  resourceHref: (data) =>
    data.resourceType === "googleSheet" ? data.url : undefined,
  LinkResourceAction: LinkGoogleSheetButton,
  taskIntegrationIds: [
    "sheet.transfer-schedule-to-wca",
    "sheet.populate-checkin",
  ],
  taskIntegrationCards: {
    "sheet.transfer-schedule-to-wca": TransferScheduleCard,
    "sheet.populate-checkin": PopulateCheckinCard,
  },
}
