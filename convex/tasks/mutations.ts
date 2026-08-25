import { mutation } from "@/convex/_generated/server"
import {
  assignTaskAndNotify,
  scheduleTaskStatusNotifications,
} from "@/convex/notifications/events"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { MutationCtx } from "@/convex/_generated/server"
import { taskKindType } from "@/convex/tasks/kind"
import {
  taskStatusCommandType,
  taskStatusType,
} from "@/convex/tasks/status/validators"
import {
  assigneesType,
  taskOwnerRef,
  taskParentRef,
  type TaskParentRef,
} from "@/convex/tasks/validators"
import { isClaimableAssigneeIds } from "@/convex/tasks/assignees"
import {
  activatePhaseBacklogTasks,
  reopenTaskStatus,
  requestTaskStatusChange,
  recomputeRelatedTaskStatuses,
  setTaskKindAndRecompute,
  setTaskOrderAndRecompute,
} from "@/convex/tasks/status/recompute"
import {
  requireTaskCreationParentAccess,
  requireTaskManageAccess,
} from "@/convex/tasks/access"
import { requireTaskManagement } from "@/convex/permissions/principal"
import {
  deriveTaskRootContextFromParent,
  taskRootPatch,
  type TaskRootContext,
} from "@/convex/tasks/hierarchy"
import {
  requireValidCreationParent,
  subtaskViewOwner,
} from "@/convex/tasks/subtaskView"
import {
  collectTaskTreeForDeletion,
  executeTaskDeletion,
  prepareTaskDeletion,
} from "@/convex/tasks/deletion"
import {
  createDeletionBudget,
  requireDeletionHeadroom,
} from "@/convex/deletion/budget"
import { objectRefKey } from "@/convex/utils"
import { v } from "convex/values"
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing"

const MAX_TASK_TREE_MUTATION_SIZE = 200
const MAX_TASK_REORDER_ITEMS = 200
const MAX_TASK_REORDER_SECTIONS = 50

async function getNextTaskOrder(ctx: MutationCtx, parent: TaskParentRef) {
  const siblings =
    parent.type === "phases"
      ? await ctx.db
          .query("tasks")
          .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
            q.eq("parent.type", "phases").eq("parent.id", parent.id)
          )
          .order("desc")
          .take(1)
      : await ctx.db
          .query("tasks")
          .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
            q.eq("parent.type", "tasks").eq("parent.id", parent.id)
          )
          .order("desc")
          .take(1)

  if (siblings.length === 0) return generateKeyBetween(null, null)

  const previousOrder = siblings[0].order
  try {
    return generateKeyBetween(previousOrder, null)
  } catch {
    return `${previousOrder}0`
  }
}

async function requireExistingTaskParent(
  ctx: MutationCtx,
  parent: TaskParentRef
) {
  const parentDoc =
    parent.type === "phases"
      ? await ctx.db.get("phases", parent.id)
      : await ctx.db.get("tasks", parent.id)

  if (parentDoc === null) {
    throw new Error("Task parent not found")
  }
}

async function requireExistingLabels(
  ctx: MutationCtx,
  labelIds: Id<"taskLabels">[]
) {
  for (const labelId of labelIds) {
    const label = await ctx.db.get("taskLabels", labelId)
    if (label === null) {
      throw new Error("Task label not found")
    }
  }
}

function parentsMatch(left: TaskParentRef, right: TaskParentRef) {
  return left.type === right.type && left.id === right.id
}

async function assertTaskCanMoveToParent(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  parent: TaskParentRef
) {
  if (parent.type !== "tasks") return
  let ancestorId: Id<"tasks"> = parent.id
  const visited = new Set<Id<"tasks">>()

  for (;;) {
    if (ancestorId === taskId) {
      throw new Error("Cannot move a task under itself or its descendants")
    }
    if (visited.has(ancestorId)) throw new Error("Task parent cycle detected")
    visited.add(ancestorId)

    const ancestor: Doc<"tasks"> | null = await ctx.db.get("tasks", ancestorId)
    if (ancestor?.parent.type !== "tasks") return
    ancestorId = ancestor.parent.id
  }
}

async function getDirectTaskChildren(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  limit = MAX_TASK_REORDER_ITEMS
) {
  const children = await ctx.db
    .query("tasks")
    .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
      q.eq("parent.type", "tasks").eq("parent.id", taskId)
    )
    .order("asc")
    .take(limit + 1)

  if (children.length > limit) {
    throw new Error(`Task has more than ${String(limit)} direct subtasks`)
  }

  return children
}

async function getDirectParentChildren(
  ctx: MutationCtx,
  parent: TaskParentRef,
  limit = MAX_TASK_REORDER_ITEMS
) {
  const children =
    parent.type === "phases"
      ? await ctx.db
          .query("tasks")
          .withIndex("by_parent_type_and_parent_id_and_order", (q) =>
            q.eq("parent.type", "phases").eq("parent.id", parent.id)
          )
          .order("asc")
          .take(limit + 1)
      : await getDirectTaskChildren(ctx, parent.id, limit)

  if (children.length > limit) {
    throw new Error(`Task parent has more than ${String(limit)} direct tasks`)
  }

  return children
}

async function patchDescendantRootContext(
  ctx: MutationCtx,
  rootTaskId: Id<"tasks">,
  root: TaskRootContext
) {
  const stack = [rootTaskId]
  const visited = new Set<Id<"tasks">>()

  while (stack.length > 0) {
    const taskId = stack.pop()
    if (taskId === undefined || visited.has(taskId)) continue
    visited.add(taskId)
    if (visited.size > MAX_TASK_TREE_MUTATION_SIZE) {
      throw new Error(
        `Task move would update more than ${String(
          MAX_TASK_TREE_MUTATION_SIZE
        )} tasks`
      )
    }

    const children = await getDirectTaskChildren(
      ctx,
      taskId,
      MAX_TASK_TREE_MUTATION_SIZE
    )
    for (const child of children) {
      await ctx.db.patch("tasks", child._id, taskRootPatch(root))
      stack.push(child._id)
    }
  }
}

export const createTask = mutation({
  args: {
    name: v.string(),
    description: v.nullable(v.string()),
    parent: taskParentRef,
    scope: subtaskViewOwner,
    initialStatus: v.optional(taskStatusType),
    assigneeIds: assigneesType,
    owner: taskOwnerRef,
    dueDate: v.nullable(v.string()),
    labelIds: v.array(v.id("taskLabels")),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const name = args.name.trim()
    if (name.length === 0) throw new Error("Task name is required")
    await requireValidCreationParent(ctx, args.scope, args.parent)
    const principal = await requireTaskCreationParentAccess(ctx, args.parent)

    await requireExistingTaskParent(ctx, args.parent)
    const labelIds = Array.from(new Set(args.labelIds))
    await requireExistingLabels(ctx, labelIds)
    const assigneeIds = Array.isArray(args.assigneeIds)
      ? Array.from(new Set(args.assigneeIds))
      : args.assigneeIds

    const descTrim = args.description?.trim()
    const description =
      descTrim !== undefined && descTrim.length > 0 ? descTrim : null
    const status = args.initialStatus ?? "backlog"
    const root = await deriveTaskRootContextFromParent(ctx, args.parent)
    const taskId = await ctx.db.insert("tasks", {
      name,
      description,
      parent: args.parent,
      ...taskRootPatch(root),
      order: await getNextTaskOrder(ctx, args.parent),
      assigneeIds: null,
      owner: args.owner,
      dueDate: args.dueDate,
      kind: "standard",
      status,
      statusIntent: { type: "manual", status },
    })

    if (assigneeIds !== null) {
      await assignTaskAndNotify(ctx, {
        taskId,
        actorId: principal.userId,
        assigneeIds,
      })
    }

    for (const labelId of labelIds) {
      await ctx.db.insert("taskLabelAssignments", {
        taskId,
        labelId,
      })
    }

    await scheduleTaskStatusNotifications(
      ctx,
      await recomputeRelatedTaskStatuses(ctx, taskId),
      principal.userId
    )

    return taskId
  },
})

export const setTaskDetails = mutation({
  args: {
    id: v.id("tasks"),
    name: v.string(),
    description: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTaskManageAccess(ctx, args.id)
    const name = args.name.trim()
    if (name.length === 0) throw new Error("Task name is required")

    const descTrim = args.description?.trim()
    const description =
      descTrim !== undefined && descTrim.length > 0 ? descTrim : null

    await ctx.db.patch("tasks", args.id, { name, description })
  },
})

export const setTaskStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: taskStatusCommandType,
  },
  handler: async (ctx, args) => {
    const { principal } = await requireTaskManageAccess(ctx, args.id)
    const result = await requestTaskStatusChange(ctx, args.id, args.status)
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
  },
})

export const reopenTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { principal } = await requireTaskManageAccess(ctx, args.id)
    const result = await reopenTaskStatus(ctx, args.id)
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
  },
})

export const setTaskKind = mutation({
  args: {
    id: v.id("tasks"),
    kind: taskKindType,
  },
  handler: async (ctx, args) => {
    const { principal } = await requireTaskManageAccess(ctx, args.id)
    const result = await setTaskKindAndRecompute(ctx, args.id, args.kind)
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
  },
})

export const setTaskOrder = mutation({
  args: {
    id: v.id("tasks"),
    order: v.string(),
  },
  handler: async (ctx, args) => {
    const { principal } = await requireTaskManageAccess(ctx, args.id)
    const result = await setTaskOrderAndRecompute(ctx, args.id, args.order)
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
  },
})

export const reorderTasks = mutation({
  args: {
    parent: taskParentRef,
    taskIds: v.array(v.id("tasks")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const principal = await requireTaskCreationParentAccess(ctx, args.parent)
    if (args.taskIds.length > MAX_TASK_REORDER_ITEMS) {
      throw new Error(
        `Cannot reorder more than ${String(MAX_TASK_REORDER_ITEMS)} tasks`
      )
    }

    const uniqueTaskIds = new Set(args.taskIds)
    if (uniqueTaskIds.size !== args.taskIds.length) {
      throw new Error("Task reorder contains duplicate tasks")
    }

    await requireExistingTaskParent(ctx, args.parent)
    const siblings = await getDirectParentChildren(ctx, args.parent)
    if (siblings.length !== args.taskIds.length) {
      throw new Error("Task list changed. Refresh and try again.")
    }

    const siblingById = new Map(siblings.map((task) => [task._id, task]))
    for (const taskId of args.taskIds) {
      const task = siblingById.get(taskId)
      if (task === undefined || !parentsMatch(task.parent, args.parent)) {
        throw new Error("Task does not belong to this parent")
      }
    }

    const orderKeys = generateNKeysBetween(null, null, args.taskIds.length)
    for (const [index, taskId] of args.taskIds.entries()) {
      const task = siblingById.get(taskId)
      if (task?.order === orderKeys[index]) continue
      await ctx.db.patch("tasks", taskId, { order: orderKeys[index] })
    }

    if (args.parent.type === "tasks") {
      const result = await recomputeRelatedTaskStatuses(ctx, args.parent.id)
      await scheduleTaskStatusNotifications(ctx, result, principal.userId)
    }

    return null
  },
})

export const reorderTaskSections = mutation({
  args: {
    sections: v.array(
      v.object({
        parent: taskParentRef,
        taskIds: v.array(v.id("tasks")),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.sections.length > MAX_TASK_REORDER_SECTIONS) {
      throw new Error(
        `Cannot reorder more than ${String(MAX_TASK_REORDER_SECTIONS)} sections`
      )
    }
    if (args.sections.length === 0) {
      await requireTaskManagement(ctx)
      return null
    }
    const principal = await requireTaskCreationParentAccess(
      ctx,
      args.sections[0].parent
    )

    const parentKeys = new Set<string>()
    const submittedTaskIds = new Set<Id<"tasks">>()
    let submittedTaskCount = 0

    for (const section of args.sections) {
      const key = objectRefKey(section.parent)
      if (parentKeys.has(key)) {
        throw new Error("Task reorder contains duplicate parents")
      }
      parentKeys.add(key)

      submittedTaskCount += section.taskIds.length
      if (submittedTaskCount > MAX_TASK_REORDER_ITEMS) {
        throw new Error(
          `Cannot reorder more than ${String(MAX_TASK_REORDER_ITEMS)} tasks`
        )
      }

      for (const taskId of section.taskIds) {
        if (submittedTaskIds.has(taskId)) {
          throw new Error("Task reorder contains duplicate tasks")
        }
        submittedTaskIds.add(taskId)
      }
    }

    for (const section of args.sections) {
      await requireTaskCreationParentAccess(ctx, section.parent)
    }

    const siblingsById = new Map<
      Id<"tasks">,
      Awaited<ReturnType<typeof getDirectParentChildren>>[number]
    >()
    const affectedParentTaskIds = new Set<Id<"tasks">>()

    for (const section of args.sections) {
      await requireExistingTaskParent(ctx, section.parent)
      if (section.parent.type === "tasks") {
        affectedParentTaskIds.add(section.parent.id)
      }

      const siblings = await getDirectParentChildren(ctx, section.parent)
      for (const sibling of siblings) {
        if (siblingsById.has(sibling._id)) {
          throw new Error("Task list contains duplicate existing tasks")
        }
        siblingsById.set(sibling._id, sibling)
      }
    }

    if (siblingsById.size !== submittedTaskCount) {
      throw new Error("Task list changed. Refresh and try again.")
    }

    for (const taskId of submittedTaskIds) {
      const task = siblingsById.get(taskId)
      if (task === undefined) {
        throw new Error("Task does not belong to a reordered parent")
      }
      if (task.parent.type === "tasks") {
        affectedParentTaskIds.add(task.parent.id)
      }
    }

    for (const section of args.sections) {
      const orderKeys =
        section.taskIds.length > 0
          ? generateNKeysBetween(null, null, section.taskIds.length)
          : []

      for (const [index, taskId] of section.taskIds.entries()) {
        const task = siblingsById.get(taskId)
        if (task === undefined) {
          throw new Error("Task does not belong to a reordered parent")
        }
        await assertTaskCanMoveToParent(ctx, taskId, section.parent)
        const order = orderKeys[index]
        if (parentsMatch(task.parent, section.parent) && task.order === order) {
          continue
        }
        const root = await deriveTaskRootContextFromParent(ctx, section.parent)
        await ctx.db.patch("tasks", taskId, {
          parent: section.parent,
          ...taskRootPatch(root),
          order,
        })
        if (!parentsMatch(task.parent, section.parent)) {
          await patchDescendantRootContext(ctx, taskId, root)
        }
      }
    }

    for (const parentTaskId of affectedParentTaskIds) {
      const result = await recomputeRelatedTaskStatuses(ctx, parentTaskId)
      await scheduleTaskStatusNotifications(ctx, result, principal.userId)
    }

    return null
  },
})

export const deleteTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { principal, task } = await requireTaskManageAccess(ctx, args.id)

    const parentTaskId = task.parent.type === "tasks" ? task.parent.id : null
    const taskIds = await collectTaskTreeForDeletion(ctx, task._id)

    const budget = createDeletionBudget()
    const plan = await prepareTaskDeletion(ctx, taskIds, budget)
    await requireDeletionHeadroom(ctx, budget)
    await executeTaskDeletion(ctx, plan)

    if (parentTaskId !== null && !taskIds.includes(parentTaskId)) {
      const parent = await ctx.db.get("tasks", parentTaskId)
      if (parent !== null) {
        const result = await recomputeRelatedTaskStatuses(ctx, parentTaskId)
        await scheduleTaskStatusNotifications(ctx, result, principal.userId)
      }
    }

    return null
  },
})

export const activatePhaseTasks = mutation({
  args: {
    phaseId: v.id("phases"),
  },
  handler: async (ctx, args) => {
    const principal = await requireTaskCreationParentAccess(ctx, {
      type: "phases",
      id: args.phaseId,
    })
    const result = await activatePhaseBacklogTasks(ctx, args.phaseId)
    await scheduleTaskStatusNotifications(ctx, result, principal.userId)
    return null
  },
})

export const setTaskDueDate = mutation({
  args: {
    id: v.id("tasks"),
    dueDate: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTaskManageAccess(ctx, args.id)
    await ctx.db.patch("tasks", args.id, { dueDate: args.dueDate })
  },
})

export const setTaskAssignees = mutation({
  args: {
    id: v.id("tasks"),
    assigneeIds: assigneesType,
  },
  handler: async (ctx, args) => {
    const { principal } = await requireTaskManageAccess(ctx, args.id)
    const nextAssigneeIds = Array.isArray(args.assigneeIds)
      ? Array.from(new Set(args.assigneeIds))
      : args.assigneeIds

    await assignTaskAndNotify(ctx, {
      taskId: args.id,
      actorId: principal.userId,
      assigneeIds: nextAssigneeIds,
    })
  },
})

export const claimTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { principal, task } = await requireTaskManageAccess(ctx, args.id)
    if (!isClaimableAssigneeIds(task.assigneeIds)) {
      throw new Error("Task is already assigned")
    }
    await assignTaskAndNotify(ctx, {
      taskId: args.id,
      actorId: principal.userId,
      assigneeIds: [principal.userId],
    })
  },
})

export const setTaskOwner = mutation({
  args: {
    id: v.id("tasks"),
    owner: taskOwnerRef,
  },
  handler: async (ctx, args) => {
    await requireTaskManageAccess(ctx, args.id)
    await ctx.db.patch("tasks", args.id, { owner: args.owner })
  },
})

export const setTaskLabels = mutation({
  args: {
    id: v.id("tasks"),
    labelIds: v.array(v.id("taskLabels")),
  },
  handler: async (ctx, args) => {
    await requireTaskManageAccess(ctx, args.id)
    const labelIds = new Set(args.labelIds)
    const existingAssignments = await ctx.db
      .query("taskLabelAssignments")
      .withIndex("by_taskId_and_labelId", (q) => q.eq("taskId", args.id))
      .collect()

    const existingLabelIds = new Set(
      existingAssignments.map((assignment) => assignment.labelId)
    )

    const deletePromises = existingAssignments
      .filter((assignment) => !labelIds.has(assignment.labelId))
      .map((assignment) =>
        ctx.db.delete("taskLabelAssignments", assignment._id)
      )

    const insertPromises = []
    for (const labelId of labelIds) {
      if (existingLabelIds.has(labelId)) continue
      insertPromises.push(
        ctx.db.insert("taskLabelAssignments", {
          taskId: args.id,
          labelId,
        })
      )
    }

    await Promise.all([...insertPromises, ...deletePromises])
  },
})
