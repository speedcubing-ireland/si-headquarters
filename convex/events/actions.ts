"use node"

import { action, type ActionCtx } from "@/convex/_generated/server"
import { internal } from "@/convex/_generated/api"
import {
  eventReportRowValidator,
  type EventReportRow,
  type EventReportSource,
  type EventScheduleSnapshot,
} from "@/convex/events/validators"
import {
  EVENT_REPORT_CACHE_TTL_MS,
  EVENT_REPORT_FETCH_CONCURRENCY,
} from "@/convex/events/constants"
import { mapWithConcurrency } from "@/convex/events/concurrency"
import { fetchScheduleProgression } from "@/convex/plugins/sheets/googleApi"
import { parseScheduleEventRounds } from "@/convex/plugins/sheets/schedule"
import { resolveWcaBaseUrl } from "@/convex/deploymentContext"
import { resolveValidServiceToken } from "@/convex/integrations/tokens"
import { isFeatureEnabled } from "@/config/lib/organisation"
import { ConvexError, v } from "convex/values"

interface SheetLoadResult {
  snapshot: EventScheduleSnapshot | null
  error: string | null
}

interface SheetRefreshBatch {
  loadsBySheetId: Map<string, SheetLoadResult>
  refreshedSnapshots: EventScheduleSnapshot[]
}

function resolveWcaCompetition(
  source: EventReportSource,
  wcaBaseUrl: string
): EventReportSource["wcaCompetition"] {
  if (source.wcaCompetition === null) {
    return null
  }
  return {
    ...source.wcaCompetition,
    url:
      source.wcaCompetition.url ??
      `${wcaBaseUrl}/competitions/${encodeURIComponent(source.wcaCompetition.id)}`,
  }
}

function errorMessage(
  // oxlint-disable-next-line typescript/no-restricted-types -- catch values are narrowed at this boundary
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : "The competition sheet could not be read."
}

function requireSheetLoad(
  loadsBySheetId: ReadonlyMap<string, SheetLoadResult>,
  sheetId: string
): SheetLoadResult {
  const load = loadsBySheetId.get(sheetId)
  if (load === undefined) {
    throw new Error(`Missing event report load result for sheet ${sheetId}.`)
  }
  return load
}

async function fetchSheetSnapshot(
  accessToken: string,
  sheetId: string
): Promise<EventScheduleSnapshot> {
  const progression = await fetchScheduleProgression(accessToken, sheetId)
  return {
    sheetId,
    events: parseScheduleEventRounds(progression),
    fetchedAt: Date.now(),
  }
}

function cachedLoadResult(
  snapshot: EventScheduleSnapshot | null,
  error: string | null = null
): SheetLoadResult {
  return { snapshot, error }
}

async function refreshSheets(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  sheetIds: readonly string[],
  cachedBySheetId: ReadonlyMap<string, EventScheduleSnapshot>
): Promise<SheetRefreshBatch> {
  let accessToken: string
  try {
    accessToken = await resolveValidServiceToken(ctx, "google")
  } catch (error) {
    const message = errorMessage(error)
    return {
      loadsBySheetId: new Map(
        sheetIds.map((sheetId) => [
          sheetId,
          cachedLoadResult(cachedBySheetId.get(sheetId) ?? null, message),
        ])
      ),
      refreshedSnapshots: [],
    }
  }

  const attempts = await mapWithConcurrency(
    sheetIds,
    EVENT_REPORT_FETCH_CONCURRENCY,
    async (sheetId) => {
      const cached = cachedBySheetId.get(sheetId) ?? null
      try {
        const snapshot = await fetchSheetSnapshot(accessToken, sheetId)
        return {
          load: cachedLoadResult(snapshot),
          refreshedSnapshot: snapshot,
        }
      } catch (error) {
        return {
          load: cachedLoadResult(cached, errorMessage(error)),
          refreshedSnapshot: null,
        }
      }
    }
  )

  const loadsBySheetId = new Map<string, SheetLoadResult>()
  const refreshedSnapshots: EventScheduleSnapshot[] = []
  for (const [index, sheetId] of sheetIds.entries()) {
    const attempt = attempts[index]
    loadsBySheetId.set(sheetId, attempt.load)
    if (attempt.refreshedSnapshot !== null) {
      refreshedSnapshots.push(attempt.refreshedSnapshot)
    }
  }
  return { loadsBySheetId, refreshedSnapshots }
}

export const loadReport = action({
  args: {
    skipCache: v.optional(v.boolean()),
  },
  returns: v.array(eventReportRowValidator),
  handler: async (ctx, args): Promise<EventReportRow[]> => {
    if (!isFeatureEnabled("events")) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Events are not enabled for this organisation.",
      })
    }

    const { sources, snapshots } = await ctx.runQuery(
      internal.events.queries.loadReportContext,
      {}
    )
    if (sources.length === 0) {
      return []
    }

    const cachedBySheetId = new Map(
      snapshots.map((snapshot) => [snapshot.sheetId, snapshot])
    )
    const uniqueSheetIds = [
      ...new Set(sources.map((source) => source.sheet.sheetId)),
    ]
    const cacheCutoff = Date.now() - EVENT_REPORT_CACHE_TTL_MS
    const loadsBySheetId = new Map<string, SheetLoadResult>()
    const sheetIdsToRefresh: string[] = []

    for (const sheetId of uniqueSheetIds) {
      const cached = cachedBySheetId.get(sheetId) ?? null
      if (
        args.skipCache !== true &&
        cached !== null &&
        cached.fetchedAt > cacheCutoff
      ) {
        loadsBySheetId.set(sheetId, cachedLoadResult(cached))
      } else {
        sheetIdsToRefresh.push(sheetId)
      }
    }

    if (sheetIdsToRefresh.length > 0) {
      const refresh = await refreshSheets(
        ctx,
        sheetIdsToRefresh,
        cachedBySheetId
      )
      for (const [sheetId, load] of refresh.loadsBySheetId) {
        loadsBySheetId.set(sheetId, load)
      }

      if (refresh.refreshedSnapshots.length > 0) {
        await ctx.runMutation(internal.events.mutations.saveScheduleSnapshots, {
          snapshots: refresh.refreshedSnapshots,
        })
      }
    }

    const wcaBaseUrl = resolveWcaBaseUrl()
    return sources.map((source): EventReportRow => {
      const load = requireSheetLoad(loadsBySheetId, source.sheet.sheetId)
      const snapshot = load.snapshot
      return {
        ...source,
        wcaCompetition: resolveWcaCompetition(source, wcaBaseUrl),
        events: snapshot?.events ?? [],
        fetchedAt: snapshot?.fetchedAt ?? null,
        error: load.error,
      }
    })
  },
})
