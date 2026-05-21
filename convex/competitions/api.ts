import { ConvexError, v } from "convex/values"
import { internalQuery, query } from "../_generated/server"
import { requireUserId } from "../core/auth"

const competitionShape = v.object({
  _id: v.id("competitions"),
  _creationTime: v.number(),
  name: v.string(),
  description: v.optional(v.string()),
  compStart: v.string(),
  compEnd: v.string(),
  compLeadId: v.optional(v.id("users")),
  leadDelegateId: v.optional(v.id("users")),
  organiserIds: v.optional(v.array(v.id("users"))),
  compSheet: v.optional(
    v.object({ type: v.literal("google-sheet"), sheetId: v.string() })
  ),
  wcaCompetitionId: v.optional(v.string()),
  manualSponsorPropertyStatus: v.optional(
    v.union(
      v.literal("not_offered"),
      v.literal("bidding"),
      v.literal("none"),
      v.literal("sponsor")
    )
  ),
  manualSponsorId: v.optional(v.id("sponsors")),
  updatedAt: v.number(),
})

export const get = query({
  args: { competitionId: v.id("competitions") },
  returns: v.union(competitionShape, v.null()),
  handler: async (ctx, args) => {
    await requireUserId(ctx)
    return await ctx.db.get(args.competitionId)
  },
})

export const getInternal = internalQuery({
  args: { id: v.id("competitions") },
  returns: v.union(competitionShape, v.null()),
  handler: async (ctx, args) => await ctx.db.get(args.id),
})

export const requireInternal = internalQuery({
  args: { id: v.id("competitions") },
  returns: competitionShape,
  handler: async (ctx, args) => {
    const competition = await ctx.db.get(args.id)
    if (!competition) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Competition not found.",
      })
    }
    return competition
  },
})
