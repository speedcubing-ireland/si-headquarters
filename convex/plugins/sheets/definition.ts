import type { BackendIntegrationPlugin } from "@/convex/plugins/integrationTypes"
import {
  runPopulateCheckin,
  runTransferScheduleToWca,
} from "@/convex/plugins/sheets/runners"

export const sheetsPlugin: BackendIntegrationPlugin = {
  id: "sheets",
  service: "google",
  taskIntegrations: [
    {
      id: "sheet.transfer-schedule-to-wca",
      label: "Transfer schedule to WCA",
      pluginId: "sheets",
      requiredResources: [
        { resourceType: "googleSheet", resourceKey: "default" },
        { resourceType: "wcaCompetition", resourceKey: "default" },
      ],
      run: runTransferScheduleToWca,
    },
    {
      id: "sheet.populate-checkin",
      label: "Populate check-in sheet",
      pluginId: "sheets",
      requiredResources: [
        { resourceType: "googleSheet", resourceKey: "default" },
        { resourceType: "wcaCompetition", resourceKey: "default" },
      ],
      run: runPopulateCheckin,
    },
  ],
}
