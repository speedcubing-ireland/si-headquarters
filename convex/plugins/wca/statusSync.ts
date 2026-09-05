"use node"

import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { internalAction, type ActionCtx } from "@/convex/_generated/server"
import {
  competitionCountryIso2,
  isFeatureEnabled,
} from "@/config/lib/organisation"
import { resolveValidServiceToken } from "@/convex/integrations/tokens"
import { DEFAULT_COMPETITION_TEMPLATE_KEY } from "@/convex/phases/wcaMappingModel"
import { toCompetitionStatus } from "@/convex/plugins/wca/competitionStatus"
import { fetchWcaStatusSources } from "@/convex/plugins/wca/statusFetch"

/**
 * Polls the WCA for the state of every linked competition and advances phases
 * accordingly. The WCA has no webhooks, so this runs on a schedule — but it
 * costs two requests per run no matter how many competitions we run, because
 * both WCA endpoints return everything at once.
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
        ? await ctx.runQuery(
            internal.plugins.wca.statusSyncMutations
              .listLinkedWcaCompetitionIds,
            {}
          )
        : [args.wcaCompetitionId]

    if (wcaCompetitionIds.length === 0) {
      return { checked: 0, skipped: null }
    }

    const sources = await fetchWcaStatusSources(
      accessToken,
      competitionCountryIso2()
    )

    const fetchedAt = Date.now()
    let checked = 0

    for (const wcaCompetitionId of wcaCompetitionIds) {
      const mine = sources.mine.get(wcaCompetitionId)
      const index = sources.index.get(wcaCompetitionId)

      // Neither source knows this competition: it may be private to another
      // delegate's account, or the id may be wrong. Leave the last known status
      // in place rather than inventing one.
      if (mine === undefined && index === undefined) continue

      await applyStatus(ctx, {
        wcaCompetitionId,
        mine,
        index,
        fetchedAt,
      })
      checked += 1
    }

    return { checked, skipped: null }
  },
})

async function applyStatus(
  ctx: ActionCtx,
  args: Parameters<typeof toCompetitionStatus>[0]
): Promise<void> {
  await ctx.runMutation(
    internal.plugins.wca.statusSyncMutations.applyCompetitionStatus,
    {
      status: toCompetitionStatus(args),
      templateKey: DEFAULT_COMPETITION_TEMPLATE_KEY,
    }
  )
}
