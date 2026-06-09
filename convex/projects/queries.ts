import { collectAll } from "@/convex/utils"
import { query, type QueryCtx } from "@/convex/_generated/server"
import type { Doc } from "@/convex/_generated/dataModel"
import { requireCan, requirePrincipal } from "@/convex/permissions/principal"
import {
  canReadProject,
  canUpdateProject,
  requireProjectForRead,
  requireProjectForUpdate,
} from "@/convex/projects/access"
import { listAllApplicationTeamSummaries } from "@/convex/teams/model"
import {
  buildCurrentPhaseProgress,
  NO_CURRENT_PHASE_PROGRESS,
} from "@/convex/phases/progress"
import {
  hydrateProjectCard,
  hydrateProjectLead,
  hydrateProjectMembers,
} from "@/convex/projects/model"
import { toPublicUser } from "@/convex/users/queries"
import { v } from "convex/values"

const MAX_PROJECT_CARDS = 200

type ProjectScope = Doc<"projects">["scope"]

function assertBounded<T>(rows: T[], limit: number, message: string): T[] {
  if (rows.length > limit) {
    throw new Error(message)
  }
  return rows
}

async function listProjectsForScope(ctx: QueryCtx, scope: ProjectScope) {
  const projects =
    scope.type === "global"
      ? await ctx.db
          .query("projects")
          .withIndex("by_scope_type", (q) => q.eq("scope.type", "global"))
          .take(MAX_PROJECT_CARDS + 1)
      : await ctx.db
          .query("projects")
          .withIndex("by_scope_type_and_scope_id", (q) =>
            q.eq("scope.type", "teams").eq("scope.id", scope.id)
          )
          .take(MAX_PROJECT_CARDS + 1)

  return assertBounded(
    projects,
    MAX_PROJECT_CARDS,
    "Too many projects to show at once."
  )
}

async function listProjectCardsForScope(ctx: QueryCtx, scope: ProjectScope) {
  const principal = await requirePrincipal(ctx)
  const readable = []

  for (const project of await listProjectsForScope(ctx, scope)) {
    if (await canReadProject(ctx, principal, project)) {
      readable.push(await hydrateProjectCard(ctx, project))
    }
  }

  return [...readable].sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

export const listGlobalCards = query({
  args: {},
  handler: async (ctx) => {
    return await listProjectCardsForScope(ctx, { type: "global" })
  },
})

export const listForTeamCards = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get("teams", args.teamId)
    if (team === null) {
      return []
    }

    return await listProjectCardsForScope(ctx, {
      type: "teams",
      id: args.teamId,
    })
  },
})

export const getPageRoot = query({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    const project = await ctx.db.get("projects", args.id)
    if (project === null) {
      return null
    }

    if (!(await canReadProject(ctx, principal, project))) {
      return null
    }

    return {
      _id: project._id,
      name: project.name,
      description: project.description,
      status: project.status,
      scope: project.scope,
      leadUserId: project.leadUserId,
      phaseId: project.phaseId,
      canUpdate: await canUpdateProject(ctx, principal, project),
    }
  },
})

export const getProperties = query({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { project } = await requireProjectForRead(ctx, args.id)
    const phase =
      project.phaseId === null
        ? null
        : await ctx.db.get("phases", project.phaseId)

    return {
      project,
      phase,
    }
  },
})

export const getCurrentPhaseProgress = query({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { project } = await requireProjectForRead(ctx, args.id)
    if (project.phaseId === null) {
      return NO_CURRENT_PHASE_PROGRESS
    }

    return await buildCurrentPhaseProgress(ctx, project.phaseId)
  },
})

export const getLead = query({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { project } = await requireProjectForRead(ctx, args.id)
    const lead = await hydrateProjectLead(ctx, project.leadUserId)

    return {
      project,
      lead,
    }
  },
})

export const getPeople = query({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { project } = await requireProjectForRead(ctx, args.id)
    const [lead, members] = await Promise.all([
      hydrateProjectLead(ctx, project.leadUserId),
      hydrateProjectMembers(ctx, project._id),
    ])

    return {
      project,
      lead,
      members,
    }
  },
})

export const listMemberOptions = query({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { principal } = await requireProjectForUpdate(ctx, args.id)
    requireCan(principal, "read", "User")
    requireCan(principal, "read", "Team")

    const [users, teams] = await Promise.all([
      collectAll(ctx, "users"),
      listAllApplicationTeamSummaries(ctx),
    ])

    return {
      users: users.map((user) => ({
        ...toPublicUser(user),
        type: "users" as const,
      })),
      teams: teams.map((team) => ({
        ...team,
        type: "teams" as const,
      })),
    }
  },
})
