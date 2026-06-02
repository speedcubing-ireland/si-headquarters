import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import type { TaskBlockersLoader } from "@/convex/tasks/blockers/loader"
import {
  blockerCounts,
  EMPTY_BLOCKER_COUNTS,
} from "@/convex/tasks/blockers/counts"
import { taskKindType } from "@/convex/tasks/kind"
import {
  buildSubtasksWithStatusViews,
  type TaskStatusLoader,
  type TaskWithStatusView,
} from "@/convex/tasks/status/resolver"
import { taskReviewStateSummary } from "@/convex/tasks/reviews/validators"
import type { TaskStatusView } from "@/convex/tasks/status/resolver"
import {
  taskStatusCommandType,
  taskStatusIntentType,
  taskStatusType,
} from "@/convex/tasks/status/validators"
import { taskLabelColorType } from "@/convex/tasks/labels/validators"
import { toPublicUser } from "@/convex/users/queries"
import { publicUserValidator, type PublicUser } from "@/convex/users/validators"
import { v, type Infer } from "convex/values"

export const taskViewProgress = v.object({
  total: v.number(),
  terminalComplete: v.number(),
  done: v.number(),
  cancelled: v.number(),
  incomplete: v.number(),
  percent: v.number(),
})

export const taskViewStatusView = v.object({
  taskId: v.id("tasks"),
  kind: taskKindType,
  statusIntent: taskStatusIntentType,
  effectiveStatus: taskStatusType,
  isManuallyEditable: v.boolean(),
  statusOptions: v.array(taskStatusCommandType),
  availableActions: v.array(v.literal("reopen")),
  progress: taskViewProgress,
  flow: v.union(
    v.object({
      currentStepId: v.union(v.id("tasks"), v.null()),
      currentStepIndex: v.union(v.number(), v.null()),
      totalSteps: v.number(),
    }),
    v.null()
  ),
  review: taskReviewStateSummary,
})

export const taskViewTask = v.object({
  _id: v.id("tasks"),
  name: v.string(),
  order: v.string(),
  dueDate: v.nullable(v.string()),
  kind: taskKindType,
  status: taskStatusType,
  statusIntent: taskStatusIntentType,
})

export const taskViewLabel = v.object({
  _id: v.id("taskLabels"),
  code: v.string(),
  name: v.string(),
  color: taskLabelColorType,
})

export const taskViewOwner = v.union(
  v.object({
    type: v.literal("users"),
    ...publicUserValidator.fields,
  }),
  v.object({
    type: v.literal("teams"),
    _id: v.id("teams"),
    name: v.string(),
  }),
  v.null()
)

export const taskViewAssignees = v.object({
  mode: v.union(
    v.literal("none"),
    v.literal("assignable"),
    v.literal("assigned")
  ),
  count: v.number(),
  userIds: v.array(v.id("users")),
  primaryUser: v.union(publicUserValidator, v.null()),
  users: v.array(publicUserValidator),
})

export const taskViewSubtaskSummaryItem = v.object({
  _id: v.id("tasks"),
  name: v.string(),
  status: taskStatusType,
})

export const taskViewTaskDetails = v.object({
  task: taskViewTask,
  labels: v.array(taskViewLabel),
  owner: taskViewOwner,
  assignees: taskViewAssignees,
  statusView: taskViewStatusView,
  blockers: blockerCounts,
  subtaskSummary: v.array(taskViewSubtaskSummaryItem),
})

export const taskViewDisplayFields = v.object({
  taskId: v.id("tasks"),
  dueDate: v.nullable(v.string()),
  labels: v.array(taskViewLabel),
  owner: taskViewOwner,
  assignees: taskViewAssignees,
  blockers: blockerCounts,
  subtaskSummary: v.array(taskViewSubtaskSummaryItem),
})

export type TaskViewProgress = Infer<typeof taskViewProgress>
export type TaskViewTaskDetails = Infer<typeof taskViewTaskDetails>
export type TaskViewDisplayFields = Infer<typeof taskViewDisplayFields>
export type TaskViewSubtaskSummary = Infer<typeof taskViewSubtaskSummaryItem>[]

type TaskViewOwner = Infer<typeof taskViewOwner>
type TaskViewAssignees = Infer<typeof taskViewAssignees>
type TaskViewLabel = Infer<typeof taskViewLabel>

export interface HydratedTaskView {
  task: Doc<"tasks">
  statusView: TaskStatusView
  directSubtaskViews?: TaskWithStatusView[]
}

export function toTaskViewSubtaskSummary(
  views: TaskWithStatusView[]
): TaskViewSubtaskSummary {
  return views.map(({ task: subtask, statusView }) => ({
    _id: subtask._id,
    name: subtask.name,
    status: statusView.effectiveStatus,
  }))
}

const MAX_TASK_LABELS_FOR_VIEW = 20

function cached<Key, Value>(
  cache: Map<Key, Promise<Value>>,
  key: Key,
  load: () => Promise<Value>
): Promise<Value> {
  const existing = cache.get(key)
  if (existing) return existing

  const promise = load()
  cache.set(key, promise)
  return promise
}

function emptyTaskViewAssignees(
  mode: "assignable" | "none"
): TaskViewAssignees {
  return {
    mode,
    count: 0,
    userIds: [],
    primaryUser: null,
    users: [],
  }
}

export function toTaskViewStatusView(statusView: TaskStatusView) {
  const { review } = statusView

  return {
    ...statusView,
    review: {
      status: review.status,
      hasReviews: review.hasReviews,
      hasPendingReviews: review.hasPendingReviews,
      isApproved: review.isApproved,
      isOverridden: review.isOverridden,
    },
  }
}

function toTaskViewLabel(label: Doc<"taskLabels">): TaskViewLabel {
  return {
    _id: label._id,
    code: label.code,
    name: label.name,
    color: label.color,
  }
}

export function getCurrentEditableStepIndex(steps: HydratedTaskView[]) {
  const index = steps.findIndex((step) => step.statusView.isManuallyEditable)

  return index === -1 ? null : index
}

export interface TaskViewDisplayReaderOptions {
  blockersLoader?: TaskBlockersLoader
  statusLoader?: TaskStatusLoader
}

export function createTaskViewDisplayReader(
  ctx: QueryCtx,
  options: TaskViewDisplayReaderOptions = {}
) {
  const { blockersLoader, statusLoader } = options
  const labelCache = new Map<
    Id<"taskLabels">,
    Promise<Doc<"taskLabels"> | null>
  >()
  const userCache = new Map<Id<"users">, Promise<PublicUser | null>>()
  const teamCache = new Map<Id<"teams">, Promise<Doc<"teams"> | null>>()
  const subtaskSummaryCache = new Map<
    Id<"tasks">,
    Promise<TaskViewSubtaskSummary>
  >()

  const getLabel = (labelId: Id<"taskLabels">) =>
    cached(labelCache, labelId, () => ctx.db.get("taskLabels", labelId))

  const getPublicUser = (userId: Id<"users">) =>
    cached(userCache, userId, async () => {
      const user = await ctx.db.get("users", userId)
      return user ? toPublicUser(user) : null
    })

  const getTeam = (teamId: Id<"teams">) =>
    cached(teamCache, teamId, () => ctx.db.get("teams", teamId))

  async function getLabels(taskId: Id<"tasks">): Promise<Doc<"taskLabels">[]> {
    const assignments = await ctx.db
      .query("taskLabelAssignments")
      .withIndex("by_taskId_and_labelId", (q) => q.eq("taskId", taskId))
      .take(MAX_TASK_LABELS_FOR_VIEW + 1)

    if (assignments.length > MAX_TASK_LABELS_FOR_VIEW) {
      throw new Error(
        `Task has more than ${String(MAX_TASK_LABELS_FOR_VIEW)} labels`
      )
    }

    const labels = await Promise.all(
      assignments.map((assignment) => getLabel(assignment.labelId))
    )

    return labels
      .filter((label): label is Doc<"taskLabels"> => label !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async function getOwner(
    owner: Doc<"tasks">["owner"]
  ): Promise<TaskViewOwner> {
    if (!owner) return null

    if (owner.type === "users") {
      const user = await getPublicUser(owner.id)
      return user ? { type: "users", ...user } : null
    }

    const team = await getTeam(owner.id)
    return team
      ? {
          type: "teams",
          _id: team._id,
          name: team.name,
        }
      : null
  }

  async function getAssigneeUsers(
    assigneeIds: Doc<"tasks">["assigneeIds"]
  ): Promise<PublicUser[]> {
    if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) return []

    return (
      await Promise.all(assigneeIds.map((userId) => getPublicUser(userId)))
    ).filter((user): user is PublicUser => user !== null)
  }

  async function getAssignees(
    assigneeIds: Doc<"tasks">["assigneeIds"]
  ): Promise<TaskViewAssignees> {
    if (assigneeIds === "assignable")
      return emptyTaskViewAssignees("assignable")
    if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
      return emptyTaskViewAssignees("none")
    }

    const users = await getAssigneeUsers(assigneeIds)

    return {
      mode: "assigned",
      count: assigneeIds.length,
      userIds: assigneeIds,
      primaryUser: users[0] ?? null,
      users,
    }
  }

  async function getBlockerCounts(taskId: Id<"tasks">) {
    if (!blockersLoader || !statusLoader) return EMPTY_BLOCKER_COUNTS
    return await blockersLoader.getCounts(taskId, statusLoader)
  }

  async function getSubtaskSummary(
    task: Doc<"tasks">,
    directSubtaskViews?: TaskWithStatusView[]
  ): Promise<TaskViewSubtaskSummary> {
    if (directSubtaskViews !== undefined) {
      return toTaskViewSubtaskSummary(directSubtaskViews)
    }

    if (!statusLoader) return []

    return cached(subtaskSummaryCache, task._id, async () => {
      const subtasks = await statusLoader.getDirectSubtasks(task._id)
      const subtaskViews = await buildSubtasksWithStatusViews(
        statusLoader,
        task,
        subtasks
      )
      return toTaskViewSubtaskSummary(subtaskViews)
    })
  }

  async function hydrateTaskDetails({
    task,
    statusView,
    directSubtaskViews,
  }: HydratedTaskView): Promise<TaskViewTaskDetails> {
    const [labels, owner, assignees, blockers, subtaskSummary] =
      await Promise.all([
        getLabels(task._id),
        getOwner(task.owner),
        getAssignees(task.assigneeIds),
        getBlockerCounts(task._id),
        getSubtaskSummary(task, directSubtaskViews),
      ])

    return {
      task: {
        _id: task._id,
        name: task.name,
        order: task.order,
        dueDate: task.dueDate,
        kind: task.kind,
        status: task.status,
        statusIntent: task.statusIntent,
      },
      labels: labels.map(toTaskViewLabel),
      owner,
      assignees,
      statusView: toTaskViewStatusView(statusView),
      blockers,
      subtaskSummary,
    }
  }

  async function hydrateTaskDisplay({
    task,
    directSubtaskViews,
  }: {
    task: Doc<"tasks">
    directSubtaskViews?: TaskWithStatusView[]
  }): Promise<TaskViewDisplayFields> {
    const [labels, owner, assignees, blockers, subtaskSummary] =
      await Promise.all([
        getLabels(task._id),
        getOwner(task.owner),
        getAssignees(task.assigneeIds),
        getBlockerCounts(task._id),
        getSubtaskSummary(task, directSubtaskViews),
      ])

    return {
      taskId: task._id,
      dueDate: task.dueDate,
      labels: labels.map(toTaskViewLabel),
      owner,
      assignees,
      blockers,
      subtaskSummary,
    }
  }

  return {
    getAssigneeUsers,
    getAssignees,
    getLabels,
    getOwner,
    hydrateTaskDetails,
    hydrateTaskDisplay,
  }
}
