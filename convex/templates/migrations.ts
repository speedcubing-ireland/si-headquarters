import { v } from "convex/values"
import { internal } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { internalMutation, type MutationCtx } from "@/convex/_generated/server"
import { findCompetitionTaskByTemplateKey } from "@/convex/tasks/templateTasks"
import { SPONSORSHIP_TASK_TEMPLATE_KEY } from "@/convex/templates/registry"

const SPONSORSHIP_TASK_NAME = "Sponsorship"

async function findLegacySponsorshipTask(
  ctx: MutationCtx,
  competitionId: Id<"competitions">
): Promise<Doc<"tasks"> | null> {
  const phases = ctx.db
    .query("phases")
    .withIndex("by_owner_type_and_owner_id_and_sortKey", (q) =>
      q.eq("owner.type", "competitions").eq("owner.id", competitionId)
    )
  const matches: Doc<"tasks">[] = []
  for await (const phase of phases) {
    const phaseTasks = ctx.db
      .query("tasks")
      .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
        q.eq("parent.type", "phases").eq("parent.id", phase._id)
      )
    for await (const task of phaseTasks) {
      if (task.name === SPONSORSHIP_TASK_NAME) matches.push(task)
    }
  }
  return matches.length === 1 ? matches[0] : null
}

/**
 * One-off backfill: stamp the Sponsorship task of competitions created before
 * tasks carried their template key, so sponsorship auctions can find it. Only
 * an unambiguous top-level task named "Sponsorship" is tagged. Run once from
 * the dashboard: it self-schedules through every page.
 */
export const backfillSponsorshipTaskTemplateKeys = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    patched: v.number(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("competitions")
      .paginate({ numItems: 50, cursor: args.cursor ?? null })

    let patched = 0
    for (const competition of page.page) {
      const tagged = await findCompetitionTaskByTemplateKey(
        ctx,
        competition._id,
        SPONSORSHIP_TASK_TEMPLATE_KEY
      )
      if (tagged !== null) continue
      const legacy = await findLegacySponsorshipTask(ctx, competition._id)
      if (legacy === null || legacy.templateKey !== undefined) continue
      await ctx.db.patch("tasks", legacy._id, {
        templateKey: SPONSORSHIP_TASK_TEMPLATE_KEY,
      })
      patched++
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.templates.migrations.backfillSponsorshipTaskTemplateKeys,
        { cursor: page.continueCursor }
      )
    }

    return {
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      patched,
    }
  },
})
