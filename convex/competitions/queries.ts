import { collectAll } from "@/convex/utils"
import { ConvexError } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { query } from "@/convex/_generated/server"
import {
  canPerform,
  requireCan,
  requirePrincipal,
  type Principal,
} from "@/convex/permissions/principal"
import type { QueryCtx } from "@/convex/_generated/server"
import { getPublicUser, getPublicUsers } from "@/convex/users/queries"
import { v } from "convex/values"

async function getCompetitionForRead(
  ctx: QueryCtx,
  principal: Principal,
  id: Id<"competitions">
): Promise<Doc<"competitions">> {
  const competition = await ctx.db.get("competitions", id)
  if (competition === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Competition not found",
    })
  }
  requireCan(principal, "read", "Competition", competition)
  return competition
}

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("competitions"),
      name: v.string(),
    })
  ),
  handler: async (ctx) => {
    const principal = await requirePrincipal(ctx)
    const competitions = await collectAll(ctx, "competitions")
    return competitions
      .filter((competition) =>
        canPerform(principal, "read", "Competition", competition)
      )
      .map((competition) => ({
        _id: competition._id,
        name: competition.name,
      }))
  },
})

async function getCompetitionUpdate(
  ctx: QueryCtx,
  competition: Doc<"competitions">
) {
  const update = competition.updateId
    ? await ctx.db.get("competitionUpdates", competition.updateId)
    : null

  if (update?.competitionId !== competition._id) {
    return null
  }

  const author = await getPublicUser(ctx, update.authorId)

  return {
    ...update,
    author,
  }
}

export const getPageRoot = query({
  args: {
    id: v.id("competitions"),
  },
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const competition = await ctx.db.get("competitions", args.id)
    if (competition === null) {
      return null
    }
    requireCan(principal, "read", "Competition", competition)
    return competition
  },
})

export const getProperties = query({
  args: {
    id: v.id("competitions"),
  },
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const competition = await getCompetitionForRead(ctx, principal, args.id)
    const phase = competition.phaseId
      ? await ctx.db.get("phases", competition.phaseId)
      : null

    return {
      competition,
      phase,
    }
  },
})

export const getPeople = query({
  args: {
    id: v.id("competitions"),
  },
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const competition = await getCompetitionForRead(ctx, principal, args.id)
    const [compLead, leadDelegate, organisers] = await Promise.all([
      getPublicUser(ctx, competition.people.compLead),
      getPublicUser(ctx, competition.people.leadDelegate),
      getPublicUsers(ctx, competition.people.organisers),
    ])

    return {
      competition,
      people: {
        compLead,
        leadDelegate,
        organisers,
      },
    }
  },
})

export const getCurrentUpdate = query({
  args: {
    id: v.id("competitions"),
  },
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const competition = await getCompetitionForRead(ctx, principal, args.id)

    return {
      competition,
      update: await getCompetitionUpdate(ctx, competition),
    }
  },
})
