import { v, type Infer } from "convex/values"
import { internalQuery, type QueryCtx } from "@/convex/_generated/server"

export const hqLinkValidator = v.object({
  wcaCompetitionId: v.string(),
  competitionId: v.id("competitions"),
  name: v.string(),
})

export type HqLink = Infer<typeof hqLinkValidator>

/** The HQ competition linked to a WCA competition id, if there is one. */
export async function findHqLink(
  ctx: QueryCtx,
  wcaCompetitionId: string
): Promise<HqLink | null> {
  const trimmed = wcaCompetitionId.trim()
  if (trimmed === "") return null

  const competition = await ctx.db
    .query("competitions")
    .withIndex("by_wcaCompetitionId", (q) => q.eq("wcaCompetitionId", trimmed))
    .first()
  if (competition === null) return null

  return {
    wcaCompetitionId: trimmed,
    competitionId: competition._id,
    name: competition.name,
  }
}

export const resolve = internalQuery({
  args: {
    wcaCompetitionIds: v.array(v.string()),
  },
  returns: v.array(hqLinkValidator),
  handler: async (ctx, args) => {
    const links: HqLink[] = []

    for (const wcaCompetitionId of args.wcaCompetitionIds) {
      const link = await findHqLink(ctx, wcaCompetitionId)
      if (link !== null) links.push(link)
    }

    return links
  },
})
