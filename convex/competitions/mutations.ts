import { ConvexError } from "convex/values"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { mutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import {
  requireCompetitionForManage,
  requireCompetitionForUpdate,
} from "@/convex/competitions/access"
import { requireCompetitionManagement } from "@/convex/permissions/principal"
import { TEAM_NAMES, type TeamName } from "@/convex/permissions/shared"
import { isMemberOfTeam } from "@/convex/teams/model"
import {
  ownerPhaseId,
  setCurrentPhaseForOwner,
} from "@/convex/phases/setCurrentPhase"
import {
  competitionDatesFields,
  competitionPeopleFields,
} from "@/convex/competitions/validators"
import { applyCompetitionTemplate } from "@/convex/templates/resolver"
import { templateVariablesArg } from "@/convex/templates/validators"
import { normalizeNullableText } from "@/convex/utils"
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
      await requireCompetitionForManage(ctx, args.id)
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
    await requireCompetitionForUpdate(ctx, args.id)
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
    await requireCompetitionForUpdate(ctx, args.id)
    const name = args.name.trim()

    if (!name) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Competition name is required",
      })
    }
    await ctx.db.patch("competitions", args.id, {
      name,
      description: normalizeNullableText(args.description),
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
    const { principal, competition } = await requireCompetitionForUpdate(
      ctx,
      args.id
    )
    await setCurrentPhaseForOwner(ctx, {
      owner: { type: "competitions", id: args.id },
      phaseId: args.phaseId,
      actorId: principal.userId,
      previousPhaseId: ownerPhaseId(competition),
    })
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
    await requireCompetitionForManage(ctx, args.id)
    const organiserIds = [...new Set(args.organiserIds)]
    await patchPeople(ctx, args.id, (people) => ({
      ...people,
      organisers: organiserIds,
    }))
    return null
  },
})

export const createFromTemplate = mutation({
  args: {
    templateKey: v.string(),
    name: v.string(),
    description: v.nullable(v.string()),
    compDates: v.object(competitionDatesFields),
    people: v.object(competitionPeopleFields),
    variables: templateVariablesArg,
  },
  returns: v.id("competitions"),
  handler: async (ctx, args) => {
    await requireCompetitionManagement(ctx)
    const name = args.name.trim()
    if (!name) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Competition name is required",
      })
    }
    await Promise.all([
      requireUserInRoleTeam(ctx, "compLead", args.people.compLead),
      requireUserInRoleTeam(ctx, "leadDelegate", args.people.leadDelegate),
    ])

    return await applyCompetitionTemplate(ctx, {
      templateKey: args.templateKey,
      variables: args.variables,
      competition: {
        name,
        description: normalizeNullableText(args.description),
        compDates: args.compDates,
        people: {
          compLead: args.people.compLead,
          leadDelegate: args.people.leadDelegate,
          organisers: [...new Set(args.people.organisers)],
        },
      },
    })
  },
})
