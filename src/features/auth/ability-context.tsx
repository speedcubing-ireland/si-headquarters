import { useQuery } from "convex/react"
import { useMemo, type ReactNode } from "react"
import { api } from "@/convex/_generated/api"
import {
  AbilityContext,
  useCan,
  type Action,
  type Subject,
} from "@/features/auth/ability"

export type { Action, Subject }

export function AbilityProvider({ children }: { children: ReactNode }) {
  const currentPermissions = useQuery(api.permissions.queries.currentPermissions)
  const value = useMemo(
    () => ({
      isLoading: currentPermissions === undefined,
      permissions: currentPermissions?.permissions ?? [],
    }),
    [currentPermissions]
  )

  return <AbilityContext value={value}>{children}</AbilityContext>
}

export function Can({
  I,
  a,
  children,
}: {
  I: Action
  a: Subject
  children: ReactNode
}) {
  const { allowed, isLoading } = useCan(I, a)
  if (isLoading) {
    return null
  }
  return allowed ? children : null
}
