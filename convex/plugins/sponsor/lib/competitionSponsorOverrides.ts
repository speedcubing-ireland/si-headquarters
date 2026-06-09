import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import type { CompetitionSponsorPropertyStatus } from "@/convex/plugins/sponsor/lib/competitionSponsorStatus"

type DbCtx = Pick<QueryCtx | MutationCtx, "db">

export type CompetitionSponsorOverride = Pick<
  Doc<"competitionSponsorOverrides">,
  "manualSponsorId" | "manualSponsorPropertyStatus"
>

export async function getCompetitionSponsorOverride(
  ctx: DbCtx,
  competitionId: Id<"competitions">
) {
  return await ctx.db
    .query("competitionSponsorOverrides")
    .withIndex("by_competitionId", (q) => q.eq("competitionId", competitionId))
    .unique()
}

export async function getCompetitionSponsorOverridesByCompetitionId(
  ctx: DbCtx,
  competitionIds: readonly Id<"competitions">[]
) {
  const entries = await Promise.all(
    [...new Set(competitionIds)].map(async (competitionId) => {
      const override = await getCompetitionSponsorOverride(ctx, competitionId)
      return [competitionId, override] as const
    })
  )
  return new Map(entries)
}

export async function upsertCompetitionSponsorOverride(
  ctx: MutationCtx,
  args: {
    competitionId: Id<"competitions">
    manualSponsorPropertyStatus: CompetitionSponsorPropertyStatus | undefined
    manualSponsorId: Id<"sponsors"> | undefined
    updatedById: Id<"users">
  }
) {
  const existing = await getCompetitionSponsorOverride(ctx, args.competitionId)
  const patch = {
    manualSponsorPropertyStatus: args.manualSponsorPropertyStatus,
    manualSponsorId: args.manualSponsorId,
    updatedById: args.updatedById,
    updatedAt: Date.now(),
  }
  if (existing === null) {
    await ctx.db.insert("competitionSponsorOverrides", {
      competitionId: args.competitionId,
      ...patch,
    })
    return
  }
  await ctx.db.patch("competitionSponsorOverrides", existing._id, patch)
}
