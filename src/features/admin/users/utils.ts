import type { Permission } from "@/convex/permissions/shared"
import type { FunctionReturnType } from "convex/server"
import type { api } from "@/convex/_generated/api"

export type AdminUser = FunctionReturnType<
  typeof api.users.queries.listForAdmin
>[number]

export type UserManagementTeam = FunctionReturnType<
  typeof api.teams.queries.listForUserManagement
>[number]

export function buildLinkedDiscordByUserId(
  users: AdminUser[]
): Map<string, { userId: AdminUser["_id"]; label: string }> {
  const map = new Map<string, { userId: AdminUser["_id"]; label: string }>()
  for (const user of users) {
    if (user.discordUserId === undefined) {
      continue
    }
    map.set(user.discordUserId, {
      userId: user._id,
      label: userDisplayName(user),
    })
  }
  return map
}

export function formatPermissionLabel(permission: Permission): string {
  if (permission.subject === "all") {
    return `${permission.action}: all`
  }
  return `${permission.action}:${permission.subject}`
}

export function userDisplayName(
  user: Pick<AdminUser, "name" | "email">
): string {
  return user.name ?? user.email ?? "Unnamed user"
}
