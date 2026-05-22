import { v } from "convex/values"

/*
 The status of the task can be computed.
 Computed status occurs when:
 - depends on it's subtasks (flow)
 - > in progress but with reviewers
 - > in progress but with blockers
*/
const UNFINISHED_TASK_STATUS = [
  "backlog",
  "to-do",
  "in-progress",
] as const

const FINISHED_TASK_STATUS = [
  "awaiting-review",
  "done",
  "cancelled"
] as const

const TASK_STATUS = [
  "computed",
  ...UNFINISHED_TASK_STATUS,
  ...FINISHED_TASK_STATUS,
] as const

const taskStatusType = v.union(
  ...TASK_STATUS.map((status) => v.literal(status))
)

const assigneesType = v.union(
  v.null(),
  v.literal("assignable"),
  v.array(v.id("users"))
);


/*
It is intentional that all tasks need to have a parent.
If at a later point we want to allow isolated tasks, we can
add a specific parent that allows for a user to have tasks
Access to the parent is how ultimately we will allow for access to the task
(Though such security is not yet implemented...) 
*/
export const taskParentRef = v.union(
  ...(["phases", "tasks"] as const).map((tableName) =>
    v.object({
      type: v.literal(tableName),
      id: v.id(tableName),
    })
  )
)

export const taskOwnerRef = v.union(
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
  status: taskStatusType,
}
