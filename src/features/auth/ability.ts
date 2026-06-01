import { createContext, use } from "react"
import type { Action, Permission, Subject } from "@/convex/permissions/shared"

export type { Action, Permission, Subject }

interface AbilityState {
  isLoading: boolean
  permissions: Permission[]
}

export const AbilityContext = createContext<AbilityState>({
  isLoading: true,
  permissions: [],
})

function permissionMatches(
  permission: Permission,
  action: Action,
  subject: Subject
): boolean {
  return (
    (permission.action === action || permission.action === "manage") &&
    (permission.subject === subject || permission.subject === "all")
  )
}

export function can(
  permissions: readonly Permission[],
  action: Action,
  subject: Subject
): boolean {
  return permissions.some((permission) =>
    permissionMatches(permission, action, subject)
  )
}

export function useAbilityState(): AbilityState {
  return use(AbilityContext)
}

export function useCan(action: Action, subject: Subject) {
  const { isLoading, permissions } = useAbilityState()
  return {
    allowed: can(permissions, action, subject),
    isLoading,
  }
}
