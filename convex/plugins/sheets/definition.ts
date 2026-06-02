import type { BackendIntegrationPlugin } from "@/convex/plugins/core/integrationTypes"
import {
  runPopulateCheckin,
  runTransferScheduleToWca,
} from "@/convex/plugins/sheets/runners"

export const sheetsPlugin = {
  id: "sheets",
  service: "google",
  taskIntegrationRunners: {
    "sheet.transfer-schedule-to-wca": runTransferScheduleToWca,
    "sheet.populate-checkin": runPopulateCheckin,
  },
} satisfies BackendIntegrationPlugin
