import { v } from "convex/values"
import { query } from "@/convex/_generated/server"
import { requireTaskIntegrationAccess } from "@/convex/access/authorize"
import { achievementsSiteUrl } from "@/convex/settings/model"
import { getCompetitionForTask } from "@/convex/tasks/hierarchy"

/**
 * SI Achievements page for a WCA competition, where its badges are made, or
 * null when Admin → Settings has no SI Achievements site.
 */
export function achievementsCompetitionUrl(
  wcaCompetitionId: string,
  siteUrl: string | null | undefined
): string | null {
  const base = siteUrl?.trim().replace(/\/+$/, "") ?? ""
  if (base === "") return null
  return `${base}/competitions/${encodeURIComponent(wcaCompetitionId)}`
}

/**
 * SI Achievements page for the competition a task belongs to, where its badges
 * are made. `url` is null until the competition is linked to a WCA competition
 * (or when the deployment has not configured the site).
 */
export const getBadgesLinkForTask = query({
  args: { taskId: v.id("tasks") },
  returns: v.object({
    wcaCompetitionId: v.union(v.string(), v.null()),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const { task } = await requireTaskIntegrationAccess(ctx, args.taskId)
    const competition = await getCompetitionForTask(ctx, task)
    const wcaCompetitionId = competition?.wcaCompetitionId ?? null
    return {
      wcaCompetitionId,
      url:
        wcaCompetitionId === null
          ? null
          : achievementsCompetitionUrl(
              wcaCompetitionId,
              await achievementsSiteUrl(ctx)
            ),
    }
  },
})
