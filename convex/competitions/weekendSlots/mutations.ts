import { mutation } from "@/convex/_generated/server"
import type { MutationCtx } from "@/convex/_generated/server"
import { parseLocalDate } from "@/convex/competitions/dates"
import { requireCompetitionManagement } from "@/convex/permissions/principal"
import { ConvexError, v } from "convex/values"

async function getOrCreateSlot(
  ctx: MutationCtx,
  year: number,
  weekendStart: string
) {
  const existing = await ctx.db
    .query("competitionWeekendSlots")
    .withIndex("by_year_and_weekendStart", (q) =>
      q.eq("year", year).eq("weekendStart", weekendStart)
    )
    .unique()

  if (existing) return existing

  const saturday = parseLocalDate(weekendStart)
  if (saturday?.getFullYear() !== year) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Invalid weekend for year",
    })
  }

  const id = await ctx.db.insert("competitionWeekendSlots", {
    year,
    weekendStart,
    note: "",
    announced: false,
    reserved: false,
  })

  const doc = await ctx.db.get("competitionWeekendSlots", id)
  if (doc === null) {
    throw new ConvexError({
      code: "INTERNAL_ERROR",
      message: "Failed to create weekend slot",
    })
  }
  return doc
}

export const setNote = mutation({
  args: {
    year: v.number(),
    weekendStart: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    await requireCompetitionManagement(ctx)
    const slot = await getOrCreateSlot(ctx, args.year, args.weekendStart)
    await ctx.db.patch("competitionWeekendSlots", slot._id, {
      note: args.note.trim(),
    })
    return null
  },
})

export const setAnnounced = mutation({
  args: {
    year: v.number(),
    weekendStart: v.string(),
    announced: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireCompetitionManagement(ctx)
    const slot = await getOrCreateSlot(ctx, args.year, args.weekendStart)
    await ctx.db.patch("competitionWeekendSlots", slot._id, {
      announced: args.announced,
    })
    return null
  },
})

export const setReserved = mutation({
  args: {
    year: v.number(),
    weekendStart: v.string(),
    reserved: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireCompetitionManagement(ctx)
    const slot = await getOrCreateSlot(ctx, args.year, args.weekendStart)
    await ctx.db.patch("competitionWeekendSlots", slot._id, {
      reserved: args.reserved,
    })
    return null
  },
})
