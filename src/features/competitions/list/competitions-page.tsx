import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { Page } from "@/components/layout/page"
import {
  CompetitionCalendarBoard,
  CompetitionCalendarLoading,
} from "@/features/competitions/list/competition-calendar-board"
import { api } from "@/convex/_generated/api"
import { useQuery } from "convex/react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useState } from "react"

function YearSelector({
  year,
  onChange,
}: {
  year: number
  onChange: (year: number) => void
}) {
  return (
    <ButtonGroup>
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
    <Page.Root>
      <Page.Header>
        <Page.Title>Competitions</Page.Title>
        <Page.Actions>
          <YearSelector year={year} onChange={setYear} />
        </Page.Actions>
      </Page.Header>
      <Page.Content>
        {calendar === undefined ? (
          <CompetitionCalendarLoading />
        ) : (
          <CompetitionCalendarBoard rows={calendar.rows} year={year} />
        )}
      </Page.Content>
    </Page.Root>
  )
}
