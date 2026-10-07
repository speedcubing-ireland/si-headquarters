import type { BackendIntegrationPlugin } from "@/convex/integrations/taskIntegrations/pluginContract"
import { runTransferScheduleToWca } from "@/convex/plugins/sheets/runners"

export const sheetsPlugin = {
  id: "sheets",
  service: "google",
  taskIntegrationRunners: {
    "sheet.transfer-schedule-to-wca": runTransferScheduleToWca,
  },
} satisfies BackendIntegrationPlugin
