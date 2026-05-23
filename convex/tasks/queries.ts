import { query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"

async function getTaskLabels(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<Doc<"taskLabels">[]> {
  const assignments = await ctx.db
    .query("taskLabelAssignments")
    .withIndex("by_taskId_and_labelId", (q) => q.eq("taskId", taskId))
    .collect()

  const labels = await Promise.all(
    assignments.map((assignment) => ctx.db.get(assignment.labelId))
  )

  return labels.filter((label): label is Doc<"taskLabels"> => label !== null)
}

export const getFirst = query({
  args: {},
  handler: async (ctx) => {
    const task = await ctx.db.query("tasks").first()
    if (!task) throw new Error("No tasks found in the database")

    return {
      task,
      labels: await getTaskLabels(ctx, task._id),
    }
  },
})
