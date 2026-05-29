import { Dot } from "@/components/data-selectors/phase-selector"
import { PHASE_COLOR_CLASSES } from "@/components/data-selectors/phase-meta"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CompetitionDateChipBox } from "@/features/competitions/list/competition-date-chip"
import {
  getCompetitionDateChip,
  type CompetitionCalendarCompetitionRow,
} from "@/features/competitions/list/competition-calendar-display"
import { PeopleAvatarStack } from "@/features/competitions/list/people-avatar-stack"
import type { PublicUser } from "@/convex/users/validators"
import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import {
  ClipboardPenIcon,
  FlagIcon,
  UsersIcon,
} from "lucide-react"

function PeopleGroup({
  icon: Icon,
  label,
  people,
}: {
  icon: LucideIcon
  label: string
  people: PublicUser[]
}) {
  const names = people
    .map((person) => person.name)
    .filter((name): name is string => name !== undefined && name.length > 0)
    .join(", ")

  const content = (
    <span className="inline-flex items-center gap-2">
      <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="sr-only">{label}:</span>
      <PeopleAvatarStack people={people} />
    </span>
  )

  if (people.length === 0) {
    return (
      <span className="inline-flex items-center gap-2">
        <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
        <span className="text-muted-foreground">—</span>
      </span>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default">{content}</span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">
          <span className="font-medium">{label}:</span> {names}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

export function CompetitionCalendarRow({
  row,
}: {
  row: CompetitionCalendarCompetitionRow
}) {
  const chip = getCompetitionDateChip(row)

  return (
    <Link
      to="/competitions/$id"
      params={{ id: row._id }}
      className="group mx-3 my-2 flex items-stretch gap-3 rounded-lg border bg-card px-4 py-4 shadow-sm transition-shadow hover:bg-muted/30 hover:shadow-md"
    >
      <span
        className={cn(
          "w-1.5 shrink-0 self-stretch rounded-full",
          row.phase
            ? PHASE_COLOR_CLASSES[row.phase.color]
            : "bg-muted-foreground/30"
        )}
        aria-hidden
      />

      <CompetitionDateChipBox chip={chip} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-semibold">{row.name}</span>
          {row.phase ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
              <Dot className="size-2" color={row.phase.color} />
              {row.phase.name}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
          <PeopleGroup
            icon={ClipboardPenIcon}
            label="Lead"
            people={row.compLead ? [row.compLead] : []}
          />
          <PeopleGroup
            icon={FlagIcon}
            label="Delegate"
            people={row.leadDelegate ? [row.leadDelegate] : []}
          />
          <PeopleGroup
            icon={UsersIcon}
            label="Organisers"
            people={row.organisers}
          />
        </div>
      </div>
    </Link>
  )
}
