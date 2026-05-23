import { mutation } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { v } from "convex/values"

type People = Doc<"competitions">["people"]
type PersonField = "compLead" | "leadDelegate"

async function getCompetition(ctx: MutationCtx, id: Id<"competitions">) {
  const competition = await ctx.db.get(id)
  if (!competition) throw new Error("Competition not found")
  return competition
}

async function assertUserExists(ctx: MutationCtx, userId: Id<"users"> | null) {
  if (!userId) return

  const user = await ctx.db.get(userId)
  if (!user) throw new Error("User not found")
}

async function assertUsersExist(ctx: MutationCtx, userIds: Id<"users">[]) {
  for (const userId of userIds) {
    await assertUserExists(ctx, userId)
  }
}

async function patchPeople(
  ctx: MutationCtx,
  id: Id<"competitions">,
  update: (people: People) => People
) {
  const competition = await getCompetition(ctx, id)
  await ctx.db.patch(id, { people: update(competition.people) })
}

function setPersonMutation(field: PersonField) {
  return mutation({
    args: {
      id: v.id("competitions"),
      userId: v.nullable(v.id("users")),
    },
    handler: async (ctx, args) => {
      await assertUserExists(ctx, args.userId)
      await patchPeople(ctx, args.id, (people) => ({
        ...people,
        [field]: args.userId,
      }))
      return
    },
  })
}

export const setCompDates = mutation({
  args: {
    id: v.id("competitions"),
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("competitions", args.id, {
      compDates: {
        from: args.from,
        to: args.to,
      },
    })
    return
  },
})

export const setCompDetails = mutation({
  args: {
    id: v.id("competitions"),
    name: v.string(),
    description: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim()

    if (!name) {
      throw new Error("Competition name is required")
    }

    await ctx.db.patch("competitions", args.id, {
      name,
      description: args.description,
    })
    return
  },
})

export const setCompPhase = mutation({
  args: {
    id: v.id("competitions"),
    phaseId: v.id("phases"),
  },
  handler: async (ctx, args) => {
    const phase = await ctx.db.get(args.phaseId)

    if (!phase) throw new Error("Phase not found")
    if (phase.owner.type !== "competitions" || phase.owner.id !== args.id) {
      throw new Error("Phase not found for competition")
    }

    await ctx.db.patch("competitions", args.id, {
      phaseId: args.phaseId,
    })
    return
  },
})

export const setCompLead = setPersonMutation("compLead")

export const setLeadDelegate = setPersonMutation("leadDelegate")

export const setOrganisers = mutation({
  args: {
    id: v.id("competitions"),
    organiserIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const organiserIds = [...new Set(args.organiserIds)]
    await assertUsersExist(ctx, organiserIds)

    await patchPeople(ctx, args.id, (people) => ({
      ...people,
      organisers: organiserIds,
    }))
    return
  },
})
