import type { Doc } from "@/convex/_generated/dataModel"
import type { TaskViewAssignees } from "@/convex/tasks/view"
import type { PublicUser } from "@/convex/users/validators"

type TaskAssigneeIds = Doc<"tasks">["assigneeIds"]
type TaskOwnerRef = Doc<"tasks">["owner"]
type Team = Pick<Doc<"teams">, "_id" | "name">

export type SelectedTaskOwner =
  | (PublicUser & { type: "users" })
  | (Team & { type: "teams" })

export function toTaskViewAssignees(
  value: TaskAssigneeIds,
  users: PublicUser[] | undefined
): TaskViewAssignees {
  if (value === "assignable") {
    return {
      mode: "assignable",
      count: 0,
      userIds: [],
      primaryUser: null,
      users: [],
    }
  }

  if (value === null || value.length === 0) {
    return {
      mode: "none",
      count: 0,
      userIds: [],
      primaryUser: null,
      users: [],
    }
  }

  const userById = new Map((users ?? []).map((user) => [user._id, user]))
  const selectedUsers = value
    .map((userId) => userById.get(userId))
    .filter((user): user is PublicUser => user !== undefined)

  return {
    mode: "assigned",
    count: value.length,
    userIds: value,
    primaryUser: selectedUsers[0] ?? null,
    users: selectedUsers,
  }
}

export function resolveSelectedTaskOwner(
  value: TaskOwnerRef,
  users: PublicUser[] | undefined,
  teams: Team[] | undefined
): SelectedTaskOwner | null {
  if (value === null) return null

  if (value.type === "users") {
    const user = users?.find((entry) => entry._id === value.id)
    return user ? { ...user, type: "users" } : null
  }

  const team = teams?.find((entry) => entry._id === value.id)
  return team ? { ...team, type: "teams" } : null
}
