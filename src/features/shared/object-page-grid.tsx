import type { ReactNode } from "react"

export function ObjectPageGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 @sm/main:grid-cols-2">
      {children}
    </div>
  )
}
