import type { Doc, Id } from "@/convex/_generated/dataModel"
import { query } from "@/convex/_generated/server"
import type { QueryCtx } from "@/convex/_generated/server"
import { getPublicUser, getPublicUsers } from "@/convex/users/queries"
import { v } from "convex/values"

async function getCompetition(ctx: QueryCtx, id: Id<"competitions">) {
  const competition = await ctx.db.get(id)
  if (!competition) throw new Error("Competition not found")

  return competition
}

async function getCompetitionUpdate(
  ctx: QueryCtx,
  competition: Doc<"competitions">
) {
  const update = competition.updateId
    ? await ctx.db.get(competition.updateId)
    : null

  if (!update || update.competitionId !== competition._id) {
    return null
  }

  const author = await getPublicUser(ctx, update.authorId)

  return {
    ...update,
    author,
  }
}

export const getPageRoot = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("competitions").first()
  },
})

export const getProperties = query({
  args: {
    id: v.id("competitions"),
  },
  handler: async (ctx, args) => {
    const competition = await getCompetition(ctx, args.id)
    const phase = competition.phaseId
      ? await ctx.db.get(competition.phaseId)
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
    const competition = await getCompetition(ctx, args.id)
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
    const competition = await getCompetition(ctx, args.id)

    return {
      competition,
      update: await getCompetitionUpdate(ctx, competition),
    }
  },
})
