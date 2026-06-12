import { v } from "convex/values"
import { internalQuery } from "@/convex/_generated/server"
import { isTerminalComplete } from "@/convex/tasks/status/rules"

const MAX_PROJECT_TASKS = 500
const MAX_TASK_LABEL_ASSIGNMENTS = 20

export const scanOrderingTasks = internalQuery({
  args: {
    projectId: v.id("projects"),
    thresholdDate: v.string(),
    labelCode: v.string(),
  },
  returns: v.object({
    totalCertificateTasks: v.number(),
    openCertificateTasks: v.array(
      v.object({ name: v.string(), dueDate: v.union(v.string(), v.null()) })
    ),
    needsAttention: v.array(
      v.object({ name: v.string(), dueDate: v.union(v.string(), v.null()) })
    ),
  }),
  handler: async (ctx, args) => {
    const label = await ctx.db
      .query("taskLabels")
      .withIndex("by_code", (q) => q.eq("code", args.labelCode))
      .unique()
    if (label === null) {
      return {
        totalCertificateTasks: 0,
        openCertificateTasks: [],
        needsAttention: [],
      }
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_root_type_and_root_id_and_status", (q) =>
        q.eq("root.type", "projects").eq("root.id", args.projectId)
      )
      .take(MAX_PROJECT_TASKS + 1)
    if (tasks.length > MAX_PROJECT_TASKS) {
      throw new Error("Project has too many tasks for certificate scanning.")
    }

    const certificateTasks = []
    for (const task of tasks) {
      const assignments = await ctx.db
        .query("taskLabelAssignments")
        .withIndex("by_taskId_and_labelId", (q) =>
          q.eq("taskId", task._id).eq("labelId", label._id)
        )
        .take(MAX_TASK_LABEL_ASSIGNMENTS + 1)
      if (assignments.length > MAX_TASK_LABEL_ASSIGNMENTS) {
        throw new Error("Task has too many label assignments to scan.")
      }
      if (assignments.length > 0) {
        certificateTasks.push(task)
      }
    }

    const openCertificateTasks = certificateTasks
      .filter((task) => !isTerminalComplete(task.status))
      .map((task) => ({ name: task.name, dueDate: task.dueDate }))
    const needsAttention = openCertificateTasks.filter(
      (task) => task.dueDate === null || task.dueDate <= args.thresholdDate
    )

    return {
      totalCertificateTasks: certificateTasks.length,
      openCertificateTasks,
      needsAttention,
    }
  },
})
