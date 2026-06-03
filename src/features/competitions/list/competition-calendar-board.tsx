import { CompetitionCalendarRow as CompetitionCalendarRowView } from "@/features/competitions/list/competition-calendar-row"
import {
  getInitialScrollMonthKey,
  groupCalendarRowsByMonth,
  type CompetitionCalendarRow,
} from "@/features/competitions/list/competition-calendar-display"
import { WeekendSlotRow } from "@/features/competitions/list/weekend-slot-row"
import { useLayoutEffect, useMemo, useRef } from "react"

function findOverflowScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent !== null) {
    const { overflowY } = getComputedStyle(parent)
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay"
    ) {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

function scrollElementToTopOfScrollParent(element: HTMLElement) {
  const scrollParent = findOverflowScrollParent(element)
  if (scrollParent === null) {
    element.scrollIntoView({ block: "start" })
    return
  }
  const scrollParentTop = scrollParent.getBoundingClientRect().top
  const elementTop = element.getBoundingClientRect().top
  scrollParent.scrollTop += elementTop - scrollParentTop
}

export function CompetitionCalendarBoard({
  rows,
  year,
}: {
  rows: CompetitionCalendarRow[]
  year: number
}) {
  const groups = useMemo(() => groupCalendarRowsByMonth(rows), [rows])
  const scrollTargetKey = useMemo(() => getInitialScrollMonthKey(year), [year])
  const monthSectionRefs = useRef<Map<string, HTMLElement>>(new Map())
  const hasScrolledForYear = useRef(false)
  const prevYearRef = useRef(year)

  useLayoutEffect(() => {
    if (prevYearRef.current !== year) {
      prevYearRef.current = year
      hasScrolledForYear.current = false
    }
  }, [year])

  useLayoutEffect(() => {
    if (scrollTargetKey === null || hasScrolledForYear.current) {
      return
    }
    const section = monthSectionRefs.current.get(scrollTargetKey)
    if (section === undefined) {
      return
    }
    scrollElementToTopOfScrollParent(section)
    hasScrolledForYear.current = true
  }, [scrollTargetKey, groups])

  return (
    <div className="mx-auto max-w-4xl pb-6">
      {groups.map((group, index) => (
        <section
          key={group.key}
          ref={(element) => {
            if (element !== null) {
              monthSectionRefs.current.set(group.key, element)
            } else {
              monthSectionRefs.current.delete(group.key)
            }
          }}
          className={index > 0 ? "mt-10" : undefined}
        >
          <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <h2 className="font-heading text-base font-semibold tracking-tight">
              {group.label}
            </h2>
          </div>
          {group.rows.map((row) =>
            row.kind === "competition" ? (
              <CompetitionCalendarRowView key={row._id} row={row} />
            ) : (
              <WeekendSlotRow key={row.weekendStart} row={row} year={year} />
            )
          )}
        </section>
      ))}
    </div>
  )
}
