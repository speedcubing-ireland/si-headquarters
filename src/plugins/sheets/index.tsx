import { FileSpreadsheetIcon } from "lucide-react"
import type { IntegrationPlugin } from "@/plugins/integrations/registry"
import { LinkGoogleSheetButton } from "@/plugins/sheets/link-google-sheet-button"
import { SheetRunCard } from "@/plugins/sheets/sheet-run-card"
import { TransferScheduleCard } from "@/plugins/sheets/transfer-schedule-card"

export const sheetsIntegrationPlugin = {
  id: "sheets",
  linkedResource: {
    resourceType: "googleSheet",
    objectTypes: ["competitions"],
  },
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
  DefaultTaskIntegrationCard: SheetRunCard,
  taskIntegrationCards: {
    "sheet.transfer-schedule-to-wca": TransferScheduleCard,
  },
} satisfies IntegrationPlugin
