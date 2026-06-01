import { ConvexError } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { mutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  requireCan,
  requirePrincipal,
  type Principal,
} from "@/convex/permissions/principal"
import {
  TEAM_NAMES,
  type Action,
  type TeamName,
} from "@/convex/permissions/shared"
import { isMemberOfTeam } from "@/convex/teams/model"
import { activatePhaseBacklogTasks } from "@/convex/tasks/status/recompute"
import { v } from "convex/values"

type People = Doc<"competitions">["people"]
type PersonField = "compLead" | "leadDelegate"

const PERSON_TEAM_REQUIREMENTS = {
  compLead: {
    teamName: TEAM_NAMES.COMPETITIONS,
    errorMessage: "Competition lead must be a member of the Competitions Team.",
  },
  leadDelegate: {
    teamName: TEAM_NAMES.DELEGATES,
    errorMessage: "Lead delegate must be a member of the Delegates team.",
  },
} as const satisfies Record<
  PersonField,
  { teamName: TeamName; errorMessage: string }
>

async function requireCompetition(
  ctx: MutationCtx,
  principal: Principal,
  id: Id<"competitions">,
  action: Action
): Promise<Doc<"competitions">> {
  const competition = await ctx.db.get("competitions", id)
  if (competition === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Competition not found",
    })
  }
  requireCan(principal, action, "Competition", competition)
  return competition
}

async function patchPeople(
  ctx: MutationCtx,
  id: Id<"competitions">,
  update: (people: People) => People
) {
  const competition = await ctx.db.get("competitions", id)
  if (competition === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Competition not found",
    })
  }
  const people = update(competition.people)

  await ctx.db.patch("competitions", id, { people })
}

async function requireUserInRoleTeam(
  ctx: MutationCtx,
  field: PersonField,
  userId: Id<"users"> | null
) {
  if (userId === null) {
    return
  }

  const user = await ctx.db.get("users", userId)
  if (user === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "User not found",
    })
  }

  const requirement = PERSON_TEAM_REQUIREMENTS[field]
  if (!(await isMemberOfTeam(ctx, userId, requirement.teamName))) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: requirement.errorMessage,
    })
  }
}

function setPersonMutation(field: PersonField) {
  return mutation({
    args: {
      id: v.id("competitions"),
      userId: v.nullable(v.id("users")),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const principal = await requirePrincipal(ctx)
      await requireCompetition(ctx, principal, args.id, "manage")
      await requireUserInRoleTeam(ctx, field, args.userId)
      await patchPeople(ctx, args.id, (people) => ({
        ...people,
        [field]: args.userId,
      }))
      return null
    },
  })
}

export const setCompDates = mutation({
  args: {
    id: v.id("competitions"),
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    await requireCompetition(ctx, principal, args.id, "update")
    await ctx.db.patch("competitions", args.id, {
      compDates: {
        from: args.from,
        to: args.to,
      },
    })
    return null
  },
})

export const setCompDetails = mutation({
  args: {
    id: v.id("competitions"),
    name: v.string(),
    description: v.nullable(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    await requireCompetition(ctx, principal, args.id, "update")
    const name = args.name.trim()

    if (!name) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Competition name is required",
      })
    }
    const description = args.description?.trim()
    const nextDescription =
      description !== undefined && description.length > 0 ? description : null

    await ctx.db.patch("competitions", args.id, {
      name,
      description: nextDescription,
    })
    return null
  },
})

export const setCompPhase = mutation({
  args: {
    id: v.id("competitions"),
    phaseId: v.id("phases"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    await requireCompetition(ctx, principal, args.id, "update")
    const phase = await ctx.db.get("phases", args.phaseId)

    if (phase === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Phase not found",
      })
    }
    if (phase.owner.id !== args.id) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Phase not found for competition",
      })
    }

    await ctx.db.patch("competitions", args.id, {
      phaseId: args.phaseId,
    })
    await activatePhaseBacklogTasks(ctx, args.phaseId)
    return null
  },
})

export const setCompLead = setPersonMutation("compLead")

export const setLeadDelegate = setPersonMutation("leadDelegate")

export const setOrganisers = mutation({
  args: {
    id: v.id("competitions"),
    organiserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    await requireCompetition(ctx, principal, args.id, "manage")
    const organiserIds = [...new Set(args.organiserIds)]
    await patchPeople(ctx, args.id, (people) => ({
      ...people,
      organisers: organiserIds,
    }))
    return null
  },
})
