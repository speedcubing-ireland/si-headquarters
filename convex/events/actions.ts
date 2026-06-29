"use node"

import type { Id } from "@/convex/_generated/dataModel"
import { action, type ActionCtx } from "@/convex/_generated/server"
import { internal } from "@/convex/_generated/api"
import {
  eventReportRowValidator,
  type EventReportRow,
  type EventReportSourceKind,
  type EventRound,
} from "@/convex/events/validators"
import {
  EVENT_REPORT_CACHE_TTL_MS,
  EVENT_REPORT_FETCH_CONCURRENCY,
} from "@/convex/events/constants"
import { mapWithConcurrency } from "@/convex/events/concurrency"
import { competitionPrimaryStart } from "@/convex/competitions/dates"
import { fetchScheduleProgression } from "@/convex/plugins/sheets/googleApi"
import { parseScheduleEventRounds } from "@/convex/plugins/sheets/schedule"
import { fetchPublicCompetitionEventRounds } from "@/convex/plugins/wca/api"
import {
  fetchManagedCompetitions,
  type ManagedWcaCompetition,
} from "@/convex/plugins/wca/managedCompetitions"
import { resolveWcaBaseUrl } from "@/convex/deploymentContext"
import { resolveValidServiceToken } from "@/convex/integrations/tokens"
import { isFeatureEnabled } from "@/config/lib/organisation"
import { ConvexError, v } from "convex/values"

interface CachedEvents {
  events: EventRound[]
  fetchedAt: number
}

interface ResolvedEntry {
  events: EventRound[]
  fetchedAt: number | null
  error: string | null
}

interface RefreshedSnapshot {
  key: string
  events: EventRound[]
  fetchedAt: number
}

interface ReportAccumulator {
  key: string
  competitionId: Id<"competitions"> | null
  competitionName: string
  dates: { from: string | null; to: string | null }
  sheet: { sheetId: string; title: string; url: string } | null
  wca: { id: string; url: string | null; isPublic: boolean } | null
}

function errorMessage(
  // oxlint-disable-next-line typescript/no-restricted-types -- catch values are narrowed at this boundary
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : "Event data could not be read."
}

/**
 * Loads event rounds for a set of cache keys, serving fresh cached snapshots
 * within the TTL and falling back to stale snapshots (with an error) when a
 * refresh fails.
 */
async function resolveCachedEvents(
  keys: readonly string[],
  cachedByKey: ReadonlyMap<string, CachedEvents>,
  skipCache: boolean,
  fetcher: (key: string) => Promise<EventRound[]>
): Promise<{
  entriesByKey: Map<string, ResolvedEntry>
  refreshed: RefreshedSnapshot[]
}> {
  const cutoff = Date.now() - EVENT_REPORT_CACHE_TTL_MS
  const entriesByKey = new Map<string, ResolvedEntry>()
  const toRefresh: string[] = []
  for (const key of keys) {
    const cached = cachedByKey.get(key)
    if (!skipCache && cached !== undefined && cached.fetchedAt > cutoff) {
      entriesByKey.set(key, {
        events: cached.events,
        fetchedAt: cached.fetchedAt,
        error: null,
      })
    } else {
      toRefresh.push(key)
    }
  }

  const attempts = await mapWithConcurrency(
    toRefresh,
    EVENT_REPORT_FETCH_CONCURRENCY,
    async (key) => {
      const cached = cachedByKey.get(key) ?? null
      try {
        const events = await fetcher(key)
        const fetchedAt = Date.now()
        return {
          key,
          entry: { events, fetchedAt, error: null },
          refreshed: { key, events, fetchedAt },
        }
      } catch (error) {
        return {
          key,
          entry: {
            events: cached?.events ?? [],
            fetchedAt: cached?.fetchedAt ?? null,
            error: errorMessage(error),
          },
          refreshed: null,
        }
      }
    }
  )

  const refreshed: RefreshedSnapshot[] = []
  for (const attempt of attempts) {
    entriesByKey.set(attempt.key, attempt.entry)
    if (attempt.refreshed !== null) {
      refreshed.push(attempt.refreshed)
    }
  }
  return { entriesByKey, refreshed }
}

async function loadManagedCompetitions(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">
): Promise<{
  competitions: ManagedWcaCompetition[]
  accessToken: string | null
}> {
  let accessToken: string
  try {
    accessToken = await resolveValidServiceToken(ctx, "wca")
  } catch {
    return { competitions: [], accessToken: null }
  }
  try {
    return {
      competitions: await fetchManagedCompetitions(accessToken),
      accessToken,
    }
  } catch {
    return { competitions: [], accessToken }
  }
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

    const { competitions: managed, accessToken: wcaToken } =
      await loadManagedCompetitions(ctx)

    const { competitions, sheetSnapshots, wcaSnapshots } = await ctx.runQuery(
      internal.events.queries.loadReportContext,
      { wcaCompetitionIds: managed.map((competition) => competition.id) }
    )

    const accByKey = new Map<string, ReportAccumulator>()
    for (const competition of competitions) {
      const key =
        competition.wcaCompetitionId ?? `hq:${competition.competitionId}`
      accByKey.set(key, {
        key,
        competitionId: competition.competitionId,
        competitionName: competition.competitionName,
        dates: competition.dates,
        sheet: competition.sheet,
        wca:
          competition.wcaCompetitionId === null
            ? null
            : { id: competition.wcaCompetitionId, url: null, isPublic: false },
      })
    }
    for (const competition of managed) {
      const existing = accByKey.get(competition.id)
      if (existing !== undefined) {
        existing.wca = {
          id: competition.id,
          url: competition.url,
          isPublic: competition.isPublic,
        }
      } else {
        accByKey.set(competition.id, {
          key: competition.id,
          competitionId: null,
          competitionName: competition.name,
          dates: { from: competition.startDate, to: competition.endDate },
          sheet: null,
          wca: {
            id: competition.id,
            url: competition.url,
            isPublic: competition.isPublic,
          },
        })
      }
    }

    const accumulators = [...accByKey.values()]
    const sheetIds = new Set<string>()
    const wcaIds = new Set<string>()
    for (const acc of accumulators) {
      if (acc.wca?.isPublic === true) {
        wcaIds.add(acc.wca.id)
      } else if (acc.sheet !== null) {
        sheetIds.add(acc.sheet.sheetId)
      }
    }

    let googleTokenPromise: Promise<string> | null = null
    const getGoogleToken = (): Promise<string> =>
      (googleTokenPromise ??= resolveValidServiceToken(ctx, "google"))

    const sheetLoad = await resolveCachedEvents(
      [...sheetIds],
      new Map(sheetSnapshots.map((s) => [s.sheetId, s])),
      args.skipCache === true,
      async (sheetId) =>
        parseScheduleEventRounds(
          await fetchScheduleProgression(await getGoogleToken(), sheetId)
        )
    )

    const wcaLoad = await resolveCachedEvents(
      [...wcaIds],
      new Map(wcaSnapshots.map((s) => [s.wcaCompetitionId, s])),
      args.skipCache === true,
      async (wcaCompetitionId) => {
        if (wcaToken === null) {
          throw new Error("WCA is not connected.")
        }
        return fetchPublicCompetitionEventRounds(wcaToken, wcaCompetitionId)
      }
    )

    if (sheetLoad.refreshed.length > 0) {
      await ctx.runMutation(internal.events.mutations.saveScheduleSnapshots, {
        snapshots: sheetLoad.refreshed.map(({ key, events, fetchedAt }) => ({
          sheetId: key,
          events,
          fetchedAt,
        })),
      })
    }
    if (wcaLoad.refreshed.length > 0) {
      await ctx.runMutation(internal.events.mutations.saveWcaSnapshots, {
        snapshots: wcaLoad.refreshed.map(({ key, events, fetchedAt }) => ({
          wcaCompetitionId: key,
          events,
          fetchedAt,
        })),
      })
    }

    const wcaBaseUrl = resolveWcaBaseUrl()
    const rows = accumulators.map((acc): EventReportRow => {
      let source: EventReportSourceKind
      let entry: ResolvedEntry | undefined
      if (acc.wca?.isPublic === true) {
        source = "wca"
        entry = wcaLoad.entriesByKey.get(acc.wca.id)
      } else if (acc.sheet !== null) {
        source = "sheet"
        entry = sheetLoad.entriesByKey.get(acc.sheet.sheetId)
      } else {
        source = "none"
      }

      return {
        key: acc.key,
        competitionId: acc.competitionId,
        competitionName: acc.competitionName,
        dates: acc.dates,
        sheet: acc.sheet,
        wcaCompetition:
          acc.wca === null
            ? null
            : {
                id: acc.wca.id,
                url:
                  acc.wca.url ??
                  `${wcaBaseUrl}/competitions/${encodeURIComponent(acc.wca.id)}`,
                isPublic: acc.wca.isPublic,
              },
        source,
        events: entry?.events ?? [],
        fetchedAt: entry?.fetchedAt ?? null,
        error:
          source === "none"
            ? "No public WCA schedule or linked Google Sheet is available."
            : (entry?.error ?? null),
      }
    })

    return rows.sort((left, right) => {
      const leftDate = competitionPrimaryStart(left.dates) ?? "9999-12-31"
      const rightDate = competitionPrimaryStart(right.dates) ?? "9999-12-31"
      return (
        leftDate.localeCompare(rightDate) ||
        left.competitionName.localeCompare(right.competitionName)
      )
    })
  },
})
