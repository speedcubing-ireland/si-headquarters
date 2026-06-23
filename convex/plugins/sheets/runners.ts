"use node"

import type {
  TaskIntegrationRunContext,
  TaskIntegrationRunResult,
} from "@/convex/integrations/taskIntegrations/pluginContract"
import { requireRunResource } from "@/convex/integrations/taskIntegrations/runResource"
import { getCheckinShareEmail } from "@/convex/plugins/sheets/constants"
import { shareSheetWithEmail } from "@/convex/plugins/sheets/googleApi"
import { fetchGoogleAndWcaTokens } from "@/convex/plugins/sheets/tokens"
import type { ActionCtx } from "@/convex/_generated/server"
import {
  executePopulateCheckin,
  executePushScheduleToWca,
} from "@/convex/plugins/wca/scheduleTransferCore"

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

export async function runPopulateCheckin(
  ctx: ActionCtx,
  run: TaskIntegrationRunContext
): Promise<TaskIntegrationRunResult> {
  const sheet = requireRunResource(run, "googleSheet")
  const wca = requireRunResource(run, "wcaCompetition")
  const { googleAccessToken, wcaAccessToken } =
    await fetchGoogleAndWcaTokens(ctx)

  const result = await executePopulateCheckin({
    googleAccessToken,
    wcaAccessToken,
    sheetId: sheet.sheetId,
    wcaCompetitionId: wca.wcaCompetitionId,
  })

  if (!result.success) {
    return {
      status: "error",
      lastMessage: result.error,
      output: null,
    }
  }

  try {
    const checkinShareEmail = getCheckinShareEmail()
    await shareSheetWithEmail(
      googleAccessToken,
      sheet.sheetId,
      checkinShareEmail
    )
  } catch (err) {
    const checkinShareEmail = getCheckinShareEmail()
    return {
      status: "error",
      lastMessage: `Wrote ${String(result.rowsWritten)} accepted registrations, but sharing the sheet with ${checkinShareEmail} failed: ${err instanceof Error ? err.message : "Unknown error"}. Share it manually in Google Drive.`,
      output: {
        kind: "checkin_populate",
        rowsWritten: result.rowsWritten,
      },
    }
  }

  const checkinShareEmail = getCheckinShareEmail()
  return {
    status: "completed",
    lastMessage: `Wrote ${String(result.rowsWritten)} accepted registrations and shared the sheet with ${checkinShareEmail}.`,
    output: {
      kind: "checkin_populate",
      rowsWritten: result.rowsWritten,
    },
  }
}
