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
  needsRefundDeadline,
  observeCompetition,
  withRefundDeadline,
} from "@/convex/plugins/wca/competitionStatus"
import {
  fetchCompetitionDetailOrNone,
  fetchWcaStatusSources,
} from "@/convex/plugins/wca/statusFetch"
import { mapWithConcurrency } from "@/convex/plugins/events/concurrency"
import type { WcaCompetitionObservation } from "@/convex/plugins/wca/validators"

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
  }),
  handler: async (ctx, args) => {
    if (!isFeatureEnabled("wcaIntegration")) {
      return { checked: 0, skipped: "WCA integration is disabled." }
    }

    let accessToken: string
    try {
      accessToken = await resolveValidServiceToken(ctx, "wca")
    } catch {
      // Not connected, or the token cannot be refreshed. The next run picks it
      // up once an admin reconnects; nothing here is worth failing the cron for.
      return { checked: 0, skipped: "WCA is not connected." }
    }

    const wcaCompetitionIds =
      args.wcaCompetitionId === undefined
        ? await loadLinkedCompetitionIds(ctx)
        : [args.wcaCompetitionId]

    if (wcaCompetitionIds.length === 0) {
      return { checked: 0, skipped: null }
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
    for (const wcaCompetitionId of wcaCompetitionIds) {
      const mine = sources.mine.get(wcaCompetitionId)
      const index = sources.index.get(wcaCompetitionId)

      // Neither source knows this competition: it may be private to another
      // delegate's account, or the id may be wrong. Leave the last known status
      // in place rather than inventing one.
      if (mine === undefined && index === undefined) continue

      observed.push(
        observeCompetition({ wcaCompetitionId, mine, index, fetchedAt })
      )
    }

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

    return { checked: observations.length, skipped: null }
  },
})

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
