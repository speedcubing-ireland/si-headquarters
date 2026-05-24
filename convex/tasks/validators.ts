import { v } from "convex/values"
import { taskKindType } from "@/convex/tasks/kind"
import {
  taskStatusIntentType,
  taskStatusType,
} from "@/convex/tasks/status/validators"

export const assigneesType = v.union(
  v.null(),
  v.literal("assignable"),
  v.array(v.id("users"))
)

// Ultimately we will allow personal tasks, but through a special type of parent
export const taskParentRef = v.union(
  ...(["phases", "tasks"] as const).map((tableName) =>
    v.object({
      type: v.literal(tableName),
      id: v.id(tableName),
    })
  )
)

export const taskOwnerRef = v.union(
  v.null(),
  ...(["users", "teams"] as const).map((tableName) =>
    v.object({
      type: v.literal(tableName),
      id: v.id(tableName),
    })
  )
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
