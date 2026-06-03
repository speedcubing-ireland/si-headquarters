import { v, type Infer } from "convex/values"
import { internalQuery } from "@/convex/_generated/server"

export const hqLinkValidator = v.object({
  wcaCompetitionId: v.string(),
  competitionId: v.id("competitions"),
  name: v.string(),
})

export type HqLink = Infer<typeof hqLinkValidator>

export const resolve = internalQuery({
  args: {
    wcaCompetitionIds: v.array(v.string()),
  },
  returns: v.array(hqLinkValidator),
  handler: async (ctx, args) => {
    const links: HqLink[] = []

    for (const wcaCompetitionId of args.wcaCompetitionIds) {
      const trimmed = wcaCompetitionId.trim()
      if (trimmed === "") continue

      const competition = await ctx.db
        .query("competitions")
        .withIndex("by_wcaCompetitionId", (q) =>
          q.eq("wcaCompetitionId", trimmed)
        )
        .first()

      if (competition === null) continue

      links.push({
        wcaCompetitionId: trimmed,
        competitionId: competition._id,
        name: competition.name,
      })
    }

    return links
  },
})
