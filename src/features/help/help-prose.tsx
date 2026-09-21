import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/**
 * Presentational primitives shared by every help topic body. Authored sections
 * compose these rather than reaching for raw Tailwind, so the whole help area
 * reads as one document however many people have written parts of it.
 */

export function Prose({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}

/** A label as it is written in the interface, so readers can pattern-match. */
export function Ui({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>
}

export function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-muted-foreground/60">
      {children}
    </ul>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm">
      {children}
    </p>
  )
}

/**
 * A term and its meaning. Used where the app's vocabulary is the thing being
 * taught, which is most of what confuses people the first time.
 */
export function Definitions({
  items,
}: {
  items: readonly { term: string; description: ReactNode }[]
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-[minmax(7rem,auto)_1fr] sm:gap-x-6">
      {items.map((item) => (
        <div key={item.term} className="contents">
          <dt className="text-sm font-medium text-foreground">{item.term}</dt>
          <dd className="text-sm">{item.description}</dd>
        </div>
      ))}
    </dl>
  )
}
