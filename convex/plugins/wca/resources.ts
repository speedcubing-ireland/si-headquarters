"use node"

import { v } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import { internal } from "@/convex/_generated/api"
import { action } from "@/convex/_generated/server"
import { upsertLinkedCompetitionResource } from "@/convex/plugins/core/linkCompetitionResource"
import { lookupWcaCompetition } from "@/convex/plugins/wca/api"
import { createWcaClient } from "@/convex/plugins/wca/client"
import {
  competitionList2,
  getMyCompetitions,
} from "@/convex/plugins/wca/openapiClient/sdk.gen"
import type {
  CompetitionIndex,
  MyCompetition,
} from "@/convex/plugins/wca/openapiClient/types.gen"

const wcaCompetitionOption = v.object({
  id: v.string(),
  name: v.string(),
  city: v.string(),
  countryIso2: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  url: v.string(),
})

function mapCompetitionOption(
  competition: MyCompetition | CompetitionIndex
): {
  id: string
  name: string
  city: string
  countryIso2: string
  startDate: string
  endDate: string
  url: string
} {
  return {
    id: competition.id,
    name: competition.name,
    city: competition.city,
    countryIso2: competition.country_iso2,
    startDate: competition.start_date,
    endDate: competition.end_date,
    url:
      "url" in competition
        ? competition.url
        : `https://www.worldcubeassociation.org/competitions/${competition.id}`,
  }
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) {
      continue
    }
    seen.add(item.id)
    unique.push(item)
  }
  return unique
}

export const linkCompetition = action({
  args: {
    competitionId: v.id("competitions"),
    wcaCompetitionId: v.string(),
  },
  returns: v.id("competitionLinkedResources"),
  handler: async (ctx, args): Promise<Id<"competitionLinkedResources">> => {
    await ctx.runQuery(
      internal.plugins.core.authorize.assertCompetitionUpdateAccess,
      { competitionId: args.competitionId }
    )
    const accessToken = await ctx.runAction(
      internal.plugins.core.tokens.getValidServiceToken,
      { service: "wca" }
    )
    const wcaCompetitionId = args.wcaCompetitionId.trim()
    const { name, url } = await lookupWcaCompetition(
      accessToken,
      wcaCompetitionId
    )

    return await upsertLinkedCompetitionResource(ctx, {
      competitionId: args.competitionId,
      resourceType: "wcaCompetition",
      data: {
        resourceType: "wcaCompetition",
        wcaCompetitionId,
        name,
        url,
      },
      afterUpsert: async () => {
        await ctx.runMutation(
          internal.plugins.wca.competitionLink.patchCompetitionWcaId,
          {
            competitionId: args.competitionId,
            wcaCompetitionId,
          }
        )
      },
    })
  },
})

export const listMyCompetitions = action({
  args: { competitionId: v.id("competitions") },
  returns: v.array(wcaCompetitionOption),
  handler: async (ctx, args) => {
    await ctx.runQuery(
      internal.plugins.core.authorize.assertCompetitionUpdateAccess,
      { competitionId: args.competitionId }
    )
    const accessToken = await ctx.runAction(
      internal.plugins.core.tokens.getValidServiceToken,
      { service: "wca" }
    )
    const client = createWcaClient(accessToken)
    const response = await getMyCompetitions({ client })
    if (response.error !== undefined || response.data === undefined) {
      throw new Error("WCA my competitions lookup failed.")
    }

    return uniqueById(
      [
        ...response.data.future_competitions,
        ...response.data.past_competitions,
        ...response.data.bookmarked_competitions,
      ].map(mapCompetitionOption)
    )
  },
})

export const searchCompetitions = action({
  args: {
    competitionId: v.id("competitions"),
    query: v.string(),
  },
  returns: v.array(wcaCompetitionOption),
  handler: async (ctx, args) => {
    await ctx.runQuery(
      internal.plugins.core.authorize.assertCompetitionUpdateAccess,
      { competitionId: args.competitionId }
    )
    const query = args.query.trim()
    if (query.length === 0) {
      return []
    }
    const accessToken = await ctx.runAction(
      internal.plugins.core.tokens.getValidServiceToken,
      { service: "wca" }
    )
    const client = createWcaClient(accessToken)
    const response = await competitionList2({
      client,
      query: { q: query, sort: "-start_date" },
    })
    if (response.error !== undefined || response.data === undefined) {
      throw new Error("WCA competition search failed.")
    }

    return response.data.slice(0, 20).map(mapCompetitionOption)
  },
})
