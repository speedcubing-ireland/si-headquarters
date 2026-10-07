"use node"

import type {
  TaskIntegrationRunContext,
  TaskIntegrationRunResult,
} from "@/convex/integrations/taskIntegrations/pluginContract"
import { requireRunResource } from "@/convex/integrations/taskIntegrations/runResource"
import { fetchGoogleAndWcaTokens } from "@/convex/plugins/sheets/tokens"
import type { ActionCtx } from "@/convex/_generated/server"
import { executePushScheduleToWca } from "@/convex/plugins/wca/scheduleTransferCore"

export async function runTransferScheduleToWca(
  ctx: ActionCtx,
  run: TaskIntegrationRunContext
): Promise<TaskIntegrationRunResult> {
  const sheet = requireRunResource(run, "googleSheet")
  const wca = requireRunResource(run, "wcaCompetition")
  const { googleAccessToken, wcaAccessToken } =
    await fetchGoogleAndWcaTokens(ctx)

  const result = await executePushScheduleToWca({
    googleAccessToken,
    wcaAccessToken,
    sheetId: sheet.sheetId,
    wcaCompetitionId: wca.wcaCompetitionId,
    overwriteEvents: run.input.overwriteEvents ?? false,
  })

  if (!result.success) {
    return {
      status: "error",
      lastMessage: result.error,
      output: null,
    }
  }

  return {
    status: "awaiting_manual_events_confirmation",
    lastMessage:
      "Schedule uploaded to WCA. Confirm events in the WCA admin UI, then mark complete here.",
    output: {
      kind: "schedule_transfer",
      wcaUrl: wca.url,
    },
  }
}
