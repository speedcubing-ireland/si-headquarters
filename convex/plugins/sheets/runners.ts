"use node"

import {
  type IntegrationRunResult,
  requireRunResource,
  type RunContext,
} from "@/convex/plugins/core/integrationTypes"
import { CHECKIN_SHARE_EMAIL } from "@/convex/plugins/sheets/constants"
import { shareSheetWithEmail } from "@/convex/plugins/sheets/googleApi"
import { fetchGoogleAndWcaTokens } from "@/convex/plugins/sheets/tokens"
import type { ActionCtx } from "@/convex/_generated/server"
import {
  executePopulateCheckin,
  executePushScheduleToWca,
} from "@/convex/plugins/wca/scheduleTransferCore"

export async function runTransferScheduleToWca(
  ctx: ActionCtx,
  run: RunContext
): Promise<IntegrationRunResult> {
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
  run: RunContext
): Promise<IntegrationRunResult> {
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
    await shareSheetWithEmail(
      googleAccessToken,
      sheet.sheetId,
      CHECKIN_SHARE_EMAIL
    )
  } catch (err) {
    return {
      status: "error",
      lastMessage: `Wrote ${String(result.rowsWritten)} accepted registrations, but sharing the sheet with ${CHECKIN_SHARE_EMAIL} failed: ${err instanceof Error ? err.message : "Unknown error"}. Share it manually in Google Drive.`,
      output: {
        kind: "checkin_populate",
        rowsWritten: result.rowsWritten,
      },
    }
  }

  return {
    status: "completed",
    lastMessage: `Wrote ${String(result.rowsWritten)} accepted registrations and shared the sheet with ${CHECKIN_SHARE_EMAIL}.`,
    output: {
      kind: "checkin_populate",
      rowsWritten: result.rowsWritten,
    },
  }
}
