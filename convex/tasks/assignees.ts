import type { Doc, Id } from "@/convex/_generated/dataModel"

type TaskAssigneeIds = Doc<"tasks">["assigneeIds"]

export function normalizeTaskAssigneeIds(assigneeIds: TaskAssigneeIds) {
  return Array.isArray(assigneeIds) && assigneeIds.length === 0
    ? null
    : assigneeIds
}

export function concreteAssigneeIds(
  assigneeIds: TaskAssigneeIds
): Id<"users">[] {
  return Array.isArray(assigneeIds) ? assigneeIds : []
}

export function isClaimableAssigneeIds(assigneeIds: TaskAssigneeIds): boolean {
  return (
    assigneeIds === "assignable" ||
    assigneeIds === null ||
    (Array.isArray(assigneeIds) && assigneeIds.length === 0)
  )
}

export function userAssigneeIdsFromField(
  assigneeIds: TaskAssigneeIds
): Id<"users">[] | null {
  return Array.isArray(assigneeIds) ? assigneeIds : null
}

export function sameUserIdList(
  left: Id<"users">[] | null,
  right: Id<"users">[] | null
) {
  if (left === null || right === null) return left === right
  if (left.length !== right.length) return false
  const rightIds = new Set(right)
  return left.every((userId) => rightIds.has(userId))
}
