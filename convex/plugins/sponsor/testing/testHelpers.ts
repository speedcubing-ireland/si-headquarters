import type { Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"

export async function insertTestCompetition(
  ctx: MutationCtx,
  args: {
    name: string
    from: string
    to: string
    organisers?: Id<"users">[]
    wcaCompetitionId?: string
  },
): Promise<Id<"competitions">> {
  return await ctx.db.insert("competitions", {
    name: args.name,
    description: null,
    people: {
      compLead: null,
      leadDelegate: null,
      organisers: args.organisers ?? [],
    },
    compDates: {
      from: args.from,
      to: args.to,
    },
    phaseId: null,
    updateId: null,
    wcaCompetitionId: args.wcaCompetitionId,
  })
}
