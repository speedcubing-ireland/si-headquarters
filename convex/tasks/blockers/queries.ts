import { query } from "@/convex/_generated/server"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { listRootTaskIds } from "@/convex/tasks/blockers/root"
import { getTaskRootRef } from "@/convex/tasks/hierarchy"
import {
  requireTaskManageAccess,
  requireTaskReadAccess,
} from "@/convex/tasks/access"
import { TaskBlockersLoader } from "@/convex/tasks/blockers/loader"
import {
  potentialBlockerTask,
  taskBlockersForTask,
  type taskBlockerView,
} from "@/convex/tasks/blockers/validators"
import {
  buildTaskStatusView,
  TaskStatusLoader,
} from "@/convex/tasks/status/resolver"
import { isTerminalComplete } from "@/convex/tasks/status/rules"
import { createTaskViewDisplayReader } from "@/convex/tasks/view"
import { v, type Infer } from "convex/values"

type TaskBlockerView = Infer<typeof taskBlockerView>
type TaskViewDisplayReader = ReturnType<typeof createTaskViewDisplayReader>

async function hydrateBlockerView(
  displayReader: TaskViewDisplayReader,
  edge: Doc<"taskBlockers">,
  taskId: Id<"tasks">,
  statusLoader: TaskStatusLoader
): Promise<TaskBlockerView | null> {
  const task = await statusLoader.getTask(taskId)
  if (!task) return null

  const [assignees, statusView] = await Promise.all([
    displayReader.getAssignees(task.assigneeIds),
    buildTaskStatusView(statusLoader, task),
  ])

  return {
    _id: edge._id,
    task: {
      _id: task._id,
      name: task.name,
      kind: task.kind,
      status: task.status,
      statusIntent: task.statusIntent,
      effectiveStatus: statusView.effectiveStatus,
      assignees,
    },
  }
}

export const getForTask = query({
  args: {
    id: v.id("tasks"),
  },
  returns: taskBlockersForTask,
  handler: async (ctx, args) => {
    await requireTaskReadAccess(ctx, args.id)

    const blockersLoader = new TaskBlockersLoader(ctx)
    const statusLoader = new TaskStatusLoader(ctx)
    const displayReader = createTaskViewDisplayReader(ctx)

    const [blockingMeEdges, blockedByMeEdges] = await Promise.all([
      blockersLoader.getBlockersOf(args.id),
      blockersLoader.getBlockedBy(args.id),
    ])

    const [blockingMe, blockedByMe] = await Promise.all([
      Promise.all(
        blockingMeEdges.map((edge) =>
          hydrateBlockerView(
            displayReader,
            edge,
            edge.blockingTaskId,
            statusLoader
          )
        )
      ),
      Promise.all(
        blockedByMeEdges.map((edge) =>
          hydrateBlockerView(
            displayReader,
            edge,
            edge.blockedTaskId,
            statusLoader
          )
        )
      ),
    ])

    return {
      blockingMe: blockingMe.filter(
        (view): view is TaskBlockerView => view !== null
      ),
      blockedByMe: blockedByMe.filter(
        (view): view is TaskBlockerView => view !== null
      ),
    }
  },
})

export const listPotentialBlockers = query({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.array(potentialBlockerTask),
  handler: async (ctx, args) => {
    const { task } = await requireTaskManageAccess(ctx, args.taskId)

    const blockersLoader = new TaskBlockersLoader(ctx)
    const [rootTaskIds, blockingMeEdges, blockedByMeEdges] = await Promise.all([
      listRootTaskIds(ctx, getTaskRootRef(task)),
      blockersLoader.getBlockersOf(args.taskId),
      blockersLoader.getBlockedBy(args.taskId),
    ])

    const excludedIds = new Set<Id<"tasks">>([args.taskId])
    for (const edge of blockingMeEdges) {
      excludedIds.add(edge.blockingTaskId)
    }
    for (const edge of blockedByMeEdges) {
      excludedIds.add(edge.blockedTaskId)
    }

    const candidates = rootTaskIds.filter((id) => !excludedIds.has(id))

    const tasks = await Promise.all(
      candidates.map((id) => ctx.db.get("tasks", id))
    )

    return tasks
      .filter((candidate): candidate is Doc<"tasks"> => candidate !== null)
      .filter((candidate) => !isTerminalComplete(candidate.status))
      .map((candidate) => ({
        _id: candidate._id,
        name: candidate.name,
        kind: candidate.kind,
        status: candidate.status,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})
