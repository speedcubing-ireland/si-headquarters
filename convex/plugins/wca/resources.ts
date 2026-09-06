"use node"

import { ConvexError, v } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import { internal } from "@/convex/_generated/api"
import { action } from "@/convex/_generated/server"
import { resolveValidServiceToken } from "@/convex/integrations/tokens"
import { competitionOrProjectRef } from "@/convex/utils"
import { lookupWcaCompetition } from "@/convex/plugins/wca/api"
import {
  fetchMyCompetitionOptions,
  searchCompetitionOptions as searchWcaCompetitionOptions,
  wcaCompetitionOption,
  type WcaCompetitionOption,
} from "@/convex/plugins/wca/competitionOptions"

export const linkCompetition = action({
  args: {
    object: competitionOrProjectRef,
    wcaCompetitionId: v.string(),
  },
  returns: v.id("objectLinkedResources"),
  handler: async (ctx, args): Promise<Id<"objectLinkedResources">> => {
    if (args.object.type !== "competitions") {
      throw new Error("WCA competitions can only be linked to competitions.")
    }
    await ctx.runQuery(internal.access.authorize.assertObjectUpdateAccess, {
      object: args.object,
    })
    const accessToken = await resolveValidServiceToken(ctx, "wca")
    const wcaCompetitionId = args.wcaCompetitionId.trim()
    const { name, url } = await lookupWcaCompetition(
      accessToken,
      wcaCompetitionId
    )

    const resourceId = await ctx.runMutation(
      internal.plugins.wca.competitionLink.saveCompetitionLink,
      {
        competitionId: args.object.id,
        wcaCompetitionId,
        name,
        url,
      }
    )

    // Pick up the competition's WCA state straight away rather than leaving it
    // in the wrong phase until the hourly sync. Scheduled rather than awaited:
    // the link is already saved, and the user should not wait on WCA round
    // trips for work the cron would retry anyway.
    await ctx.scheduler.runAfter(
      0,
      internal.plugins.wca.statusSync.syncCompetitionStatuses,
      { wcaCompetitionId }
    )

    return resourceId
  },
})

export const listMyCompetitions = action({
  args: { object: competitionOrProjectRef },
  returns: v.array(wcaCompetitionOption),
  handler: async (ctx, args): Promise<WcaCompetitionOption[]> => {
    if (args.object.type !== "competitions") {
      throw new Error("WCA competitions can only be linked to competitions.")
    }
    await ctx.runQuery(internal.access.authorize.assertObjectUpdateAccess, {
      object: args.object,
    })
    const accessToken = await resolveValidServiceToken(ctx, "wca")
    return fetchMyCompetitionOptions(accessToken)
  },
})

/**
 * Runs the WCA status sync for one competition, for the "Sync now" button. The
 * hourly cron covers everything eventually; this exists so a freshly linked
 * competition doesn't sit in the wrong phase until the next run.
 */
export const syncCompetitionStatus = action({
  args: {
    competitionId: v.id("competitions"),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await ctx.runQuery(internal.access.authorize.assertObjectUpdateAccess, {
      object: { type: "competitions", id: args.competitionId },
    })
    const wcaCompetitionId = await ctx.runQuery(
      internal.plugins.wca.statusSyncMutations.getLinkedWcaCompetitionId,
      { competitionId: args.competitionId }
    )
    if (wcaCompetitionId === null) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Link this competition to the WCA before syncing it.",
      })
    }
    await ctx.runAction(
      internal.plugins.wca.statusSync.syncCompetitionStatuses,
      { wcaCompetitionId }
    )
    return null
  },
})

export const searchCompetitions = action({
  args: {
    object: competitionOrProjectRef,
    query: v.string(),
  },
  returns: v.array(wcaCompetitionOption),
  handler: async (ctx, args): Promise<WcaCompetitionOption[]> => {
    if (args.object.type !== "competitions") {
      throw new Error("WCA competitions can only be linked to competitions.")
    }
    await ctx.runQuery(internal.access.authorize.assertObjectUpdateAccess, {
      object: args.object,
    })
    const accessToken = await resolveValidServiceToken(ctx, "wca")
    return searchWcaCompetitionOptions(accessToken, args.query)
  },
})
