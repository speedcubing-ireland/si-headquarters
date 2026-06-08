import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { TaskStatusLoader } from "@/convex/tasks/status/resolver"
import {
  recomputeRelatedTaskStatuses,
  type TaskStatusMutationResult,
} from "@/convex/tasks/status/recompute"
import { manualIntent } from "@/convex/tasks/status/rules"
import { generateKeyBetween } from "fractional-indexing"

type TaskParent = Doc<"tasks">["parent"]

async function getDirectChildTasks(
  ctx: MutationCtx,
  parent: TaskParent
): Promise<Doc<"tasks">[]> {
  const loader = new TaskStatusLoader(ctx)

  if (parent.type === "tasks") {
    return await loader.getDirectSubtasks(parent.id)
  }

  return await loader.getPhaseTasks(parent.id)
}

async function assertParentExists(ctx: MutationCtx, parent: TaskParent) {
  if (parent.type === "tasks") {
    const task = await ctx.db.get("tasks", parent.id)
    if (task === null) throw new Error("Parent task not found")
    return
  }

  const phase = await ctx.db.get("phases", parent.id)
  if (phase === null) throw new Error("Parent phase not found")
}

export async function createChildTaskAndRecompute(
  ctx: MutationCtx,
  args: {
    parent: TaskParent
    name: string
    description: string | null
  }
): Promise<{ taskId: Id<"tasks">; result: TaskStatusMutationResult }> {
  await assertParentExists(ctx, args.parent)

  const siblings = await getDirectChildTasks(ctx, args.parent)
  const order = generateKeyBetween(siblings.at(-1)?.order ?? null, null)
  const status = "backlog"

  const taskId = await ctx.db.insert("tasks", {
    name: args.name,
    description: args.description,
    parent: args.parent,
    order,
    assigneeIds: null,
    owner: null,
    dueDate: null,
    kind: "standard",
    status,
    statusIntent: manualIntent(status),
  })

  const result = await recomputeRelatedTaskStatuses(ctx, taskId)
  return { taskId, result }
}
