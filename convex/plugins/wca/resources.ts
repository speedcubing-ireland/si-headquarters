"use node"

import { v } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import { internal } from "@/convex/_generated/api"
import { action } from "@/convex/_generated/server"
import { upsertLinkedObjectResource } from "@/convex/integrations/linkObjectResource"
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
    const accessToken = await ctx.runAction(
      internal.integrations.tokens.getValidServiceToken,
      { service: "wca" }
    )
    const wcaCompetitionId = args.wcaCompetitionId.trim()
    const { name, url } = await lookupWcaCompetition(
      accessToken,
      wcaCompetitionId
    )

    const resourceId = await upsertLinkedObjectResource(ctx, {
      object: args.object,
      resourceType: "wcaCompetition",
      data: {
        resourceType: "wcaCompetition",
        wcaCompetitionId,
        name,
        url,
      },
    })
    await ctx.runMutation(
      internal.plugins.wca.competitionLink.patchCompetitionWcaId,
      {
        competitionId: args.object.id,
        wcaCompetitionId,
      }
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
    const accessToken = await ctx.runAction(
      internal.integrations.tokens.getValidServiceToken,
      { service: "wca" }
    )
    return fetchMyCompetitionOptions(accessToken)
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
    const accessToken = await ctx.runAction(
      internal.integrations.tokens.getValidServiceToken,
      { service: "wca" }
    )
    return searchWcaCompetitionOptions(accessToken, args.query)
  },
})
