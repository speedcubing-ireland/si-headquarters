"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction, type ActionCtx } from "@/convex/_generated/server"
import {
  competitionCountryIso2,
  isFeatureEnabled,
} from "@/config/lib/organisation"
import { resolveValidServiceToken } from "@/convex/integrations/tokens"
import {
  isHeldBy,
  needsRefundDeadline,
  observeCompetition,
  withRefundDeadline,
} from "@/convex/plugins/wca/competitionStatus"
import {
  fetchCompetitionDetailOrNone,
  fetchWcaStatusSources,
  probeCompetitionExists,
  type WcaStatusSources,
} from "@/convex/plugins/wca/statusFetch"
import { mapManagedCompetition } from "@/convex/plugins/wca/managedCompetitions"
import { mapWithConcurrency } from "@/convex/plugins/events/concurrency"
import type {
  WcaCompetitionObservation,
  WcaRenameOption,
} from "@/convex/plugins/wca/validators"

interface SyncResult {
  checked: number
  skipped: string | null
  /** Linked ids the WCA answered 404 for this run. */
  missing: string[]
}

/** Parallel detail requests, matching the events plugin's fan-out budget. */
const WCA_DETAIL_FETCH_CONCURRENCY = 6

/**
 * Polls the WCA for the state of every linked competition and advances phases
 * accordingly. The WCA has no webhooks, so this runs on a schedule.
 *
 * Two requests cover every competition, because both bulk WCA endpoints return
 * everything at once. On top of that, a competition costs one request each run
 * while its refund deadline is still ahead of it — that date lives only on the
 * single-competition endpoint. That set is small: announced, uncancelled, not
 * yet held, and not already known to be past its refund deadline.
 */
export const syncCompetitionStatuses = internalAction({
  args: {
    /** Limits the run to one competition, for the manual "Sync now" button. */
    wcaCompetitionId: v.optional(v.string()),
  },
  returns: v.object({
    checked: v.number(),
    skipped: v.union(v.string(), v.null()),
    missing: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<SyncResult> => {
    if (!isFeatureEnabled("wcaIntegration")) {
      return {
        checked: 0,
        skipped: "WCA integration is disabled.",
        missing: [],
      }
    }

    let accessToken: string
    try {
      accessToken = await resolveValidServiceToken(ctx, "wca")
    } catch {
      // Not connected, or the token cannot be refreshed. The next run picks it
      // up once an admin reconnects; nothing here is worth failing the cron for.
      return { checked: 0, skipped: "WCA is not connected.", missing: [] }
    }

    const wcaCompetitionIds =
      args.wcaCompetitionId === undefined
        ? await loadLinkedCompetitionIds(ctx)
        : [args.wcaCompetitionId]

    if (wcaCompetitionIds.length === 0) {
      return { checked: 0, skipped: null, missing: [] }
    }

    // The mapping is org-level and identical for every competition, so it is
    // resolved once here rather than re-read inside each transaction.
    const [sources, mappings] = await Promise.all([
      fetchWcaStatusSources(
        accessToken,
        competitionCountryIso2(),
        args.wcaCompetitionId
      ),
      ctx.runQuery(
        internal.plugins.wca.statusSyncMutations.getPhaseMappings,
        {}
      ),
    ])

    const fetchedAt = Date.now()

    // Observe from the bulk sources first, so the refund-window test decides
    // which competitions are worth a per-competition request at all.
    const observed: WcaCompetitionObservation[] = []
    const unseen: string[] = []
    for (const wcaCompetitionId of wcaCompetitionIds) {
      const mine = sources.mine.get(wcaCompetitionId)
      const index = sources.index.get(wcaCompetitionId)

      // Neither source knows this competition. It may be private to another
      // delegate's account, or the id may no longer exist. Leave the last known
      // status in place rather than inventing one, and check which it is below.
      if (mine === undefined && index === undefined) {
        unseen.push(wcaCompetitionId)
        continue
      }

      observed.push(
        observeCompetition({ wcaCompetitionId, mine, index, fetchedAt })
      )
    }

    const missing = await reportMissingCompetitions(ctx, {
      accessToken,
      unseen,
      sources,
      nowMs: fetchedAt,
    })

    const observations = await addRefundDeadlines(
      ctx,
      accessToken,
      observed,
      fetchedAt
    )

    for (const observation of observations) {
      await ctx.runMutation(
        internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
        { observation, mappings }
      )
    }

    return { checked: observations.length, skipped: null, missing }
  },
})

/**
 * Checks the linked ids neither bulk source returned, and records the ones the
 * WCA says do not exist. This is what catches a competition renamed on the WCA:
 * the rename changes its id, so the old link points at nothing and the sync
 * would otherwise skip it in silence forever.
 *
 * Only competitions not yet held are checked, and only these few ids cost a
 * request each, so a normal run still makes no extra requests at all.
 */
async function reportMissingCompetitions(
  ctx: ActionCtx,
  input: {
    accessToken: string
    unseen: readonly string[]
    sources: WcaStatusSources
    nowMs: number
  }
): Promise<string[]> {
  if (input.unseen.length === 0) return []

  const upcoming = await ctx.runQuery(
    internal.plugins.wca.statusSyncMutations.listUpcomingLinkedIds,
    { wcaCompetitionIds: [...input.unseen], nowMs: input.nowMs }
  )
  const probed = await mapWithConcurrency(
    upcoming,
    WCA_DETAIL_FETCH_CONCURRENCY,
    async (wcaCompetitionId) => ({
      wcaCompetitionId,
      result: await probeCompetitionExists(input.accessToken, wcaCompetitionId),
    })
  )
  const missing = probed
    .filter((probe) => probe.result === "missing")
    .map((probe) => probe.wcaCompetitionId)
  if (missing.length === 0) return []

  const options = renameOptions(input.sources, input.nowMs)
  for (const wcaCompetitionId of missing) {
    await ctx.runMutation(
      internal.plugins.wca.statusSyncMutations.recordMissingWcaCompetition,
      { wcaCompetitionId, options, detectedAt: input.nowMs }
    )
  }
  return missing
}

/**
 * The competitions a vanished link could have been renamed to: upcoming,
 * uncancelled competitions the connected WCA account manages. A renamed
 * competition is still managed by the same people, so `mine` is where it shows
 * up, under its new id.
 */
function renameOptions(
  sources: WcaStatusSources,
  nowMs: number
): WcaRenameOption[] {
  const options: WcaRenameOption[] = []
  for (const competition of sources.mine.values()) {
    if (competition["cancelled?"]) continue
    if (isHeldBy(competition.end_date, nowMs)) continue
    const { id, name, url, startDate, endDate } =
      mapManagedCompetition(competition)
    options.push({ id, name, url, startDate, endDate })
  }
  return options
}

/** Pages through every competition linked to the WCA. */
async function loadLinkedCompetitionIds(ctx: ActionCtx): Promise<string[]> {
  const ids: string[] = []
  let cursor: string | null = null

  for (;;) {
    // Annotated because the cursor feeds back into the call that produces it,
    // which TypeScript cannot infer through.
    const page: { ids: string[]; cursor: string | null; isDone: boolean } =
      await ctx.runQuery(
        internal.plugins.wca.statusSyncMutations.listLinkedWcaCompetitionIds,
        { cursor }
      )
    ids.push(...page.ids)
    if (page.isDone) return ids
    cursor = page.cursor
  }
}

/**
 * The observations with a refund deadline filled in, for the competitions that
 * still need one. Competitions outside the refund window are not requested at
 * all, so the flat two-request cost still holds for them, and a competition
 * whose request failed passes through unchanged — the merge then carries its
 * stored deadline forward rather than erasing it.
 */
async function addRefundDeadlines(
  ctx: ActionCtx,
  accessToken: string,
  observations: readonly WcaCompetitionObservation[],
  nowMs: number
): Promise<WcaCompetitionObservation[]> {
  const stored = await ctx.runQuery(
    internal.plugins.wca.statusSyncMutations.getStoredRefundDeadlines,
    { wcaCompetitionIds: observations.map((o) => o.wcaCompetitionId) }
  )
  const storedByCompetition = new Map(
    stored.map((row) => [row.wcaCompetitionId, row.refundDeadlineAt])
  )

  return await mapWithConcurrency(
    observations,
    WCA_DETAIL_FETCH_CONCURRENCY,
    async (observation) => {
      const storedDeadline =
        storedByCompetition.get(observation.wcaCompetitionId) ?? null
      if (!needsRefundDeadline(observation, storedDeadline, nowMs)) {
        return observation
      }
      const detail = await fetchCompetitionDetailOrNone(
        accessToken,
        observation.wcaCompetitionId
      )
      return detail === null
        ? observation
        : withRefundDeadline(observation, detail)
    }
  )
}
