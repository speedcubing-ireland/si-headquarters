import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { NavRoot } from "@/components/layout/layout-navbar"
import {
  CompetitionCalendarBoard,
  CompetitionCalendarLoading,
} from "@/features/competitions/list/competition-calendar-board"
import { api } from "@/convex/_generated/api"
import { useQuery } from "convex/react"
import { ChevronLeftIcon, ChevronRightIcon, TrophyIcon } from "lucide-react"
import { useState } from "react"

function YearSelector({
  year,
  onChange,
}: {
  year: number
  onChange: (year: number) => void
}) {
  return (
    <ButtonGroup className="ml-auto">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Previous year"
        onClick={() => { onChange(year - 1); }}
      >
        <ChevronLeftIcon />
      </Button>
      <ButtonGroupText className="min-w-14 justify-center border-x-0 bg-transparent px-3 tabular-nums">
        {year}
      </ButtonGroupText>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Next year"
        onClick={() => { onChange(year + 1); }}
      >
        <ChevronRightIcon />
      </Button>
    </ButtonGroup>
  )
}

export function CompetitionsPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const calendar = useQuery(api.competitions.calendar.listForYear, { year })

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <NavRoot>
        <TrophyIcon className="size-4 shrink-0 text-muted-foreground" />
        <h1 className="font-heading text-base font-semibold">Competitions</h1>
        <YearSelector year={year} onChange={setYear} />
      </NavRoot>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {calendar === undefined ? (
          <CompetitionCalendarLoading />
        ) : (
          <CompetitionCalendarBoard rows={calendar.rows} year={year} />
        )}
      </div>
    </div>
  )
}
