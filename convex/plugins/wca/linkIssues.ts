import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx, QueryCtx } from "@/convex/_generated/server"
import type { CompetitionDeletionPlugin } from "@/convex/competitions/deletionPlugin"
import { reserveDeletionWork } from "@/convex/deletion/budget"
import { runDeletionWork } from "@/convex/deletion/work"

/**
 * A competition has one WCA link at a time, so it should never hold more than
 * one issue row. The bound only stops a bad state from becoming an unbounded
 * read.
 */
const MAX_LINK_ISSUES_PER_COMPETITION = 10

function listLinkIssues(
  ctx: QueryCtx,
  competitionId: Id<"competitions">
): Promise<Doc<"wcaLinkIssues">[]> {
  return ctx.db
    .query("wcaLinkIssues")
    .withIndex("by_competitionId", (q) => q.eq("competitionId", competitionId))
    .take(MAX_LINK_ISSUES_PER_COMPETITION)
}

/**
 * The broken-link issue for the competition's current WCA link, if there is one.
 * An issue recorded against an id the competition is no longer linked to is
 * ignored: the competition has been relinked since.
 */
export async function getCurrentLinkIssue(
  ctx: QueryCtx,
  competition: Doc<"competitions">
): Promise<Doc<"wcaLinkIssues"> | null> {
  const wcaCompetitionId = competition.wcaCompetitionId
  if (wcaCompetitionId === undefined || wcaCompetitionId.length === 0) {
    return null
  }
  const issues = await listLinkIssues(ctx, competition._id)
  return (
    issues.find((issue) => issue.wcaCompetitionId === wcaCompetitionId) ?? null
  )
}

/**
 * Deletes the competition's broken-link issues. Called when the WCA finds the
 * competition again, and whenever its link is changed or removed.
 */
export async function clearLinkIssues(
  ctx: MutationCtx,
  competitionId: Id<"competitions">
): Promise<void> {
  const issues = await listLinkIssues(ctx, competitionId)
  await runDeletionWork(issues, async (issue) => {
    await ctx.db.delete("wcaLinkIssues", issue._id)
  })
}

export const wcaCompetitionDeletionPlugin: CompetitionDeletionPlugin = {
  id: "wca",
  prepareCompetitionDeletion: async (ctx, { budget, competition }) => {
    const issues = await listLinkIssues(ctx, competition._id)
    reserveDeletionWork(budget, {
      reason: "WCA link issues",
      writes: issues.length,
    })
    return {
      execute: async () => {
        await runDeletionWork(issues, async (issue) => {
          await ctx.db.delete("wcaLinkIssues", issue._id)
        })
      },
    }
  },
}
