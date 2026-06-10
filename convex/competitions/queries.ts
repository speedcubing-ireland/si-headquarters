import { collectAll } from "@/convex/utils"
import { query } from "@/convex/_generated/server"
import {
  getCompetitionOrNull,
  requireCompetitionForRead,
} from "@/convex/competitions/access"
import {
  canPerform,
  requireCan,
  requirePrincipal,
} from "@/convex/permissions/principal"
import { listPhasesForOwner } from "@/convex/phases/model"
import { getPublicUser, getPublicUsers } from "@/convex/users/queries"
import {
  buildCurrentPhaseProgress,
  currentPhaseProgressValidator,
  NO_CURRENT_PHASE_PROGRESS,
} from "@/convex/phases/progress"
import { v } from "convex/values"

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
    const { competition } = await requireCompetitionForRead(ctx, args.id)
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
    const { competition } = await requireCompetitionForRead(ctx, args.id)
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

export const getCurrentPhaseProgress = query({
  args: {
    id: v.id("competitions"),
  },
  returns: currentPhaseProgressValidator,
  handler: async (ctx, args) => {
    const { competition } = await requireCompetitionForRead(ctx, args.id)
    if (!competition.phaseId) {
      return NO_CURRENT_PHASE_PROGRESS
    }

    return await buildCurrentPhaseProgress(ctx, competition.phaseId)
  },
})

export const getTemplateApplicationState = query({
  args: {
    id: v.id("competitions"),
  },
  returns: v.object({
    canApply: v.boolean(),
    blockReason: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const competition = await getCompetitionOrNull(ctx, args.id)
    if (competition === null) {
      return { canApply: false, blockReason: null }
    }
    if (!canPerform(principal, "manage", "Competition", competition)) {
      return { canApply: false, blockReason: null }
    }

    const existingApplication = await ctx.db
      .query("competitionTemplateApplications")
      .withIndex("by_competitionId", (q) => q.eq("competitionId", args.id))
      .first()
    if (existingApplication !== null) {
      return {
        canApply: false,
        blockReason: "A template was already applied to this competition.",
      }
    }

    const phases = await listPhasesForOwner(ctx, {
      type: "competitions",
      id: args.id,
    })
    if (phases.length > 0) {
      return {
        canApply: false,
        blockReason: "This competition already has phases.",
      }
    }

    return { canApply: true, blockReason: null }
  },
})
