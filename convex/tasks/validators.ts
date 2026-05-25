import { v } from "convex/values"
import { taskKindType } from "@/convex/tasks/kind"
import {
  taskStatusIntentType,
  taskStatusType,
} from "@/convex/tasks/status/validators"
import { objectRef } from "@/convex/utils"

export const assigneesType = v.union(
  v.null(),
  v.literal("assignable"),
  v.array(v.id("users"))
)

// Ultimately we will allow personal tasks, but through a special type of parent
export const taskParentRef = v.union(objectRef("phases"), objectRef("tasks"))

export const taskOwnerRef = v.union(
  v.null(),
  objectRef("users"),
  objectRef("teams")
)

export const tasksFields = {
  name: v.string(),
  description: v.nullable(v.string()),
  parent: taskParentRef,
  order: v.string(),
  assigneeIds: assigneesType,
  owner: taskOwnerRef,
  dueDate: v.nullable(v.string()),
  kind: taskKindType,
  status: taskStatusType,
  statusIntent: taskStatusIntentType,
}
