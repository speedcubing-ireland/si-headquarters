import { v, type Infer } from "convex/values"
import { taskKindType } from "@/convex/tasks/kind"
import {
  taskStatusIntentType,
  taskStatusType,
} from "@/convex/tasks/status/validators"
import { taskViewAssignees } from "@/convex/tasks/view"

export { blockerCounts } from "@/convex/tasks/blockers/counts"
export type { BlockerCounts } from "@/convex/tasks/blockers/counts"

export const taskBlockersFields = {
  blockingTaskId: v.id("tasks"),
  blockedTaskId: v.id("tasks"),
}

export const taskBlockerViewTask = v.object({
  _id: v.id("tasks"),
  name: v.string(),
  kind: taskKindType,
  status: taskStatusType,
  statusIntent: taskStatusIntentType,
  effectiveStatus: taskStatusType,
  assignees: taskViewAssignees,
})

export const taskBlockerView = v.object({
  _id: v.id("taskBlockers"),
  task: taskBlockerViewTask,
})

export const taskBlockersForTask = v.object({
  blockingMe: v.array(taskBlockerView),
  blockedByMe: v.array(taskBlockerView),
})

export const potentialBlockerTask = v.object({
  _id: v.id("tasks"),
  name: v.string(),
  kind: taskKindType,
  status: taskStatusType,
})

export type TaskBlockerView = Infer<typeof taskBlockerView>
export type TaskBlockersForTask = Infer<typeof taskBlockersForTask>
export type PotentialBlockerTask = Infer<typeof potentialBlockerTask>
