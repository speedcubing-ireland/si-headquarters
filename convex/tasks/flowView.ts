import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { taskKindType } from "@/convex/tasks/kind"
import { taskReviewStateSummary } from "@/convex/tasks/reviews/validators"
import type { TaskStatusView } from "@/convex/tasks/status/resolver"
import {
  taskStatusCommandType,
  taskStatusIntentType,
  taskStatusType,
} from "@/convex/tasks/status/validators"
import { toPublicUser } from "@/convex/users/queries"
import { publicUserValidator, type PublicUser } from "@/convex/users/validators"
import { v, type Infer } from "convex/values"

const flowViewProgress = v.object({
  total: v.number(),
  terminalComplete: v.number(),
  done: v.number(),
  cancelled: v.number(),
  incomplete: v.number(),
  percent: v.number(),
})

export type FlowViewProgress = Infer<typeof flowViewProgress>

const flowViewStatusView = v.object({
  taskId: v.id("tasks"),
  kind: taskKindType,
  statusIntent: taskStatusIntentType,
  effectiveStatus: taskStatusType,
  isManuallyEditable: v.boolean(),
  statusOptions: v.array(taskStatusCommandType),
  availableActions: v.array(v.literal("reopen")),
  progress: flowViewProgress,
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

const flowViewTask = v.object({
  _id: v.id("tasks"),
  name: v.string(),
  order: v.string(),
  dueDate: v.nullable(v.string()),
  kind: taskKindType,
  status: taskStatusType,
  statusIntent: taskStatusIntentType,
})

const flowStructureTask = v.object({
  _id: v.id("tasks"),
  name: v.string(),
  order: v.string(),
  kind: taskKindType,
  status: taskStatusType,
  statusIntent: taskStatusIntentType,
})

const flowViewLabel = v.object({
  _id: v.id("taskLabels"),
  name: v.string(),
})

const flowViewOwner = v.union(
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

const flowViewAssignees = v.object({
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

export const flowViewTaskDetails = v.object({
  task: flowViewTask,
  labels: v.array(flowViewLabel),
  owner: flowViewOwner,
  assignees: flowViewAssignees,
  statusView: flowViewStatusView,
})

const flowViewParentSummary = v.object({
  taskId: v.id("tasks"),
  currentStepId: v.union(v.id("tasks"), v.null()),
  currentStepIndex: v.union(v.number(), v.null()),
  totalSteps: v.number(),
})

export const taskFlowView = v.object({
  parent: flowViewParentSummary,
  steps: v.array(flowViewTaskDetails),
})

export const taskFlowStructure = v.object({
  parent: flowViewParentSummary,
  steps: v.array(
    v.object({
      task: flowStructureTask,
      statusView: flowViewStatusView,
    })
  ),
})

export const taskFlowDisplay = v.object({
  steps: v.array(
    v.object({
      taskId: v.id("tasks"),
      dueDate: v.nullable(v.string()),
      labels: v.array(flowViewLabel),
      owner: flowViewOwner,
      assignees: flowViewAssignees,
    })
  ),
})

type FlowViewOwner = Infer<typeof flowViewOwner>
type FlowViewAssignees = Infer<typeof flowViewAssignees>
export type TaskFlowViewTaskDetails = Infer<typeof flowViewTaskDetails>
export type TaskFlowView = Infer<typeof taskFlowView>
export type TaskFlowStructure = Infer<typeof taskFlowStructure>
export type TaskFlowDisplay = Infer<typeof taskFlowDisplay>

interface HydratedStep {
  task: Doc<"tasks">
  statusView: TaskStatusView
}

const MAX_TASK_LABELS_FOR_FLOW_VIEW = 20

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

function emptyFlowViewAssignees(
  mode: "assignable" | "none"
): FlowViewAssignees {
  return {
    mode,
    count: 0,
    userIds: [],
    primaryUser: null,
    users: [],
  }
}

export function toFlowViewStatusView(statusView: TaskStatusView) {
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

export function getCurrentEditableStepIndex(steps: HydratedStep[]) {
  const index = steps.findIndex((step) => step.statusView.isManuallyEditable)

  return index === -1 ? null : index
}

export function createTaskDisplayReader(ctx: QueryCtx) {
  const labelCache = new Map<
    Id<"taskLabels">,
    Promise<Doc<"taskLabels"> | null>
  >()
  const userCache = new Map<Id<"users">, Promise<PublicUser | null>>()
  const teamCache = new Map<Id<"teams">, Promise<Doc<"teams"> | null>>()

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
      .take(MAX_TASK_LABELS_FOR_FLOW_VIEW + 1)

    if (assignments.length > MAX_TASK_LABELS_FOR_FLOW_VIEW) {
      throw new Error(
        `Task has more than ${String(MAX_TASK_LABELS_FOR_FLOW_VIEW)} labels`
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
  ): Promise<FlowViewOwner> {
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

  async function getFlowAssignees(
    assigneeIds: Doc<"tasks">["assigneeIds"]
  ): Promise<FlowViewAssignees> {
    if (assigneeIds === "assignable")
      return emptyFlowViewAssignees("assignable")
    if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
      return emptyFlowViewAssignees("none")
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

  async function hydrateFlowStep({
    task,
    statusView,
  }: HydratedStep): Promise<TaskFlowViewTaskDetails> {
    const [labels, owner, assignees] = await Promise.all([
      getLabels(task._id),
      getOwner(task.owner),
      getFlowAssignees(task.assigneeIds),
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
      labels: labels.map(({ _id, name }) => ({ _id, name })),
      owner,
      assignees,
      statusView: toFlowViewStatusView(statusView),
    }
  }

  async function hydrateFlowDisplayStep(
    task: Doc<"tasks">
  ): Promise<TaskFlowDisplay["steps"][number]> {
    const [labels, owner, assignees] = await Promise.all([
      getLabels(task._id),
      getOwner(task.owner),
      getFlowAssignees(task.assigneeIds),
    ])

    return {
      taskId: task._id,
      dueDate: task.dueDate,
      labels: labels.map(({ _id, name }) => ({ _id, name })),
      owner,
      assignees,
    }
  }

  return {
    getAssigneeUsers,
    getLabels,
    getOwner,
    hydrateFlowDisplayStep,
    hydrateFlowStep,
  }
}
