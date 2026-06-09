import { v } from "convex/values"
import { internalMutation } from "@/convex/_generated/server"
import {
  deriveTaskRootContextFromParent,
  taskRootPatch,
} from "@/convex/tasks/hierarchy"

// TODO: Remove once it has been run
/** Backfill task rootPhase/root from parent chain. Safe to run repeatedly. */
export const backfillTaskRoot = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    patched: v.number(),
    nextCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 50
    const tasks = await ctx.db.query("tasks").paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    })
    let patched = 0

    for (const task of tasks.page) {
      await ctx.db.patch(
        "tasks",
        task._id,
        taskRootPatch(await deriveTaskRootContextFromParent(ctx, task.parent))
      )
      patched += 1
    }

    return {
      processed: tasks.page.length,
      patched,
      nextCursor: tasks.isDone ? null : tasks.continueCursor,
    }
  },
})
