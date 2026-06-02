import type { ReactNode } from "react"

export function LinkActionShell({
  children,
  error,
}: {
  children: ReactNode
  error: string | null
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      {children}
      {error !== null ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : null}
    </div>
  )
}
