import { v, type Infer } from "convex/values"
import { taskKindType } from "@/convex/tasks/kind"
import {
  taskStatusIntentType,
  taskStatusType,
} from "@/convex/tasks/status/validators"
import { competitionOrProjectRef, objectRef } from "@/convex/utils"

export const assigneesType = v.union(
  v.null(),
  v.literal("assignable"),
  v.array(v.id("users"))
)

export const taskParentRef = v.union(objectRef("phases"), objectRef("tasks"))

export type TaskParentRef = Infer<typeof taskParentRef>

export const taskRootPhaseRef = objectRef("phases")

export type TaskRootPhaseRef = Infer<typeof taskRootPhaseRef>

export const taskOwnerRef = v.union(
  v.null(),
  objectRef("users"),
  objectRef("teams")
)

export const tasksFields = {
  name: v.string(),
  description: v.nullable(v.string()),
  parent: taskParentRef,
  rootPhase: taskRootPhaseRef,
  root: competitionOrProjectRef,
  order: v.string(),
  assigneeIds: assigneesType,
  owner: taskOwnerRef,
  dueDate: v.nullable(v.string()),
  kind: taskKindType,
  status: taskStatusType,
  statusIntent: taskStatusIntentType,
}
