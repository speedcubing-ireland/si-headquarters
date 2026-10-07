import { collectAll } from "@/convex/utils"
import { query } from "@/convex/_generated/server"
import { requirePrincipal } from "@/convex/permissions/principal"
import { loadTaskBoardData } from "@/convex/tasks/boardData"
import { createTaskBoardReader, taskBoardRow } from "@/convex/tasks/boardReader"
import { taskStatusType } from "@/convex/tasks/status/validators"
import { v } from "convex/values"

export const listForBoard = query({
  args: {
    teamId: v.optional(v.id("teams")),
    assignedToMe: v.optional(v.boolean()),
    effectiveStatuses: v.optional(v.array(taskStatusType)),
  },
  returns: v.array(taskBoardRow),
  handler: async (ctx, args) => {
    const principal = await requirePrincipal(ctx)
    if (args.effectiveStatuses?.length === 0) return []
    const data = await loadTaskBoardData(ctx, principal, args)
    if (data.selectedTaskIds.size === 0) return []
    // A whole board benefits from bulk label reads; scoped views hydrate lazily.
    const preloadedLabels =
      args.teamId === undefined && args.assignedToMe !== true
        ? await Promise.all([
            collectAll(ctx, "taskLabelAssignments"),
            collectAll(ctx, "taskLabels"),
          ]).then(([assignments, labels]) => ({ assignments, labels }))
        : undefined
    const reader = await createTaskBoardReader(ctx, {
      ...data,
      preloadedLabels,
    })
    const summaries = await reader.getSummaries({
      effectiveStatuses: args.effectiveStatuses,
    })
    return await reader.hydrateRows(summaries)
  },
})
