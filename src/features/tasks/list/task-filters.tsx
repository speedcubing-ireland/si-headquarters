import { TASK_STATUS_META } from "@/components/data-selectors/task-status-meta"
import { ObjectAvatar } from "@/components/object-avatar"
import type { FilterOption } from "@/features/list-views/components/filter-option-row"
import type { ArrayFilterChipDef } from "@/features/list-views/components/array-filter-chips"
import {
  matchesFilterItems,
  matchesPointInDateRange,
} from "@/features/list-views/filter-engine"
import { hasDateRangeValue } from "@/features/list-views/types"
import type { MatchMode } from "@/features/list-views/types"
import type { TaskFilterKey, TasksFilters } from "@/features/tasks/list/task-list-types"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"
import { TASK_STATUSES, isTaskStatus } from "@/convex/tasks/status/validators"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import { useQuery } from "convex/react"
import {
  CassetteTapeIcon,
  CircleDotIcon,
  TagIcon,
  TargetIcon,
  TrophyIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"
import { useMemo, type ReactNode } from "react"

type UserListEntry = Pick<Doc<"users">, "_id" | "name" | "image"> | PublicUser

export type TaskRowFilterInput = Pick<
  TaskBoardRow,
  | "statusView"
  | "task"
  | "assignees"
  | "owner"
  | "labels"
  | "competitionId"
  | "phaseId"
>

interface TaskFilterFieldConfig {
  id: TaskFilterKey
  label: string
  icon: LucideIcon
  getRowValues: (row: TaskRowFilterInput) => string[]
}

export const TASK_FILTER_FIELDS: TaskFilterFieldConfig[] = [
  {
    id: "status",
    label: "Status",
    icon: CircleDotIcon,
    getRowValues: (row) => [row.statusView.effectiveStatus],
  },
  {
    id: "kind",
    label: "Kind",
    icon: CassetteTapeIcon,
    getRowValues: (row) => [row.task.kind],
  },
  {
    id: "assignee",
    label: "Assignee",
    icon: UserIcon,
    getRowValues: (row) =>
      row.assignees.mode === "assigned" ? row.assignees.userIds : [],
  },
  {
    id: "owner",
    label: "Owner",
    icon: TargetIcon,
    getRowValues: (row) => {
      if (row.owner === null) return ["unassigned"]
      return [`${row.owner.type}:${row.owner._id}`]
    },
  },
  {
    id: "labels",
    label: "Labels",
    icon: TagIcon,
    getRowValues: (row) => row.labels.map((label) => label._id),
  },
  {
    id: "competition",
    label: "Competition",
    icon: TrophyIcon,
    getRowValues: (row) =>
      row.competitionId !== null ? [row.competitionId] : [],
  },
  {
    id: "phase",
    label: "Phase",
    icon: CircleDotIcon,
    getRowValues: (row) => (row.phaseId !== null ? [row.phaseId] : []),
  },
]

const STATUS_OPTIONS: FilterOption[] = TASK_STATUSES.map((status) => ({
  value: status,
  label: TASK_STATUS_META[status].label,
  icon: TASK_STATUS_META[status].icon,
}))

const KIND_OPTIONS: FilterOption[] = [
  { value: "standard", label: "Standard", icon: CircleDotIcon },
  { value: "flow", label: "Flow", icon: CassetteTapeIcon },
]

function userToFilterOption(user: UserListEntry): FilterOption {
  return {
    value: user._id,
    label: user.name ?? "Unknown",
    avatar: { name: user.name ?? "?", image: user.image ?? null },
  }
}

export function filterTaskRows<TRow extends TaskRowFilterInput>(
  rows: TRow[],
  filters: TasksFilters,
  matchMode: MatchMode
): TRow[] {
  const activeFields = TASK_FILTER_FIELDS.filter(
    (field) => filters[field.id].length > 0
  )
  const hasDueDate = hasDateRangeValue(filters.dueDate)

  if (activeFields.length === 0 && !hasDueDate) {
    return rows
  }

  return rows.filter((row) => {
    const matchers: boolean[] = activeFields.map((field) =>
      matchesFilterItems(
        filters[field.id],
        field.getRowValues(row),
        matchMode
      )
    )

    if (hasDueDate && filters.dueDate) {
      matchers.push(matchesPointInDateRange(row.task.dueDate, filters.dueDate))
    }

    return matchMode === "all"
      ? matchers.every(Boolean)
      : matchers.some(Boolean)
  })
}

export interface TaskFilterLookup {
  users: UserListEntry[]
  teams: { _id: string; name: string }[]
  labels: { _id: string; name: string }[]
  competitions: { _id: string; name: string }[]
  phases: { _id: string; name: string }[]
}

function renderTaskFilterValue(
  key: TaskFilterKey,
  value: string,
  lookup: TaskFilterLookup
): ReactNode {
  switch (key) {
    case "status": {
      if (!isTaskStatus(value)) return value
      const meta = TASK_STATUS_META[value]
      const Icon = meta.icon
      return (
        <span className="flex items-center gap-1 text-xs">
          <Icon className="size-3.5" />
          {meta.label}
        </span>
      )
    }
    case "kind":
      return <span className="text-xs font-medium capitalize">{value}</span>
    case "assignee": {
      const user = lookup.users.find((entry) => entry._id === value)
      if (!user) return value
      return (
        <span className="flex items-center gap-1">
          <ObjectAvatar obj={user} size="sm" />
          <span className="text-xs">{user.name}</span>
        </span>
      )
    }
    case "owner": {
      if (value === "unassigned") return "Unassigned"
      const [type, id] = value.split(":")
      if (type === "users") {
        return lookup.users.find((entry) => entry._id === id)?.name ?? value
      }
      return lookup.teams.find((entry) => entry._id === id)?.name ?? value
    }
    case "labels":
      return lookup.labels.find((entry) => entry._id === value)?.name ?? value
    case "competition":
      return (
        lookup.competitions.find((entry) => entry._id === value)?.name ?? value
      )
    case "phase":
      return lookup.phases.find((entry) => entry._id === value)?.name ?? value
    default:
      return value
  }
}

export function useTaskFilters() {
  const users = useQuery(api.users.queries.list)
  const teams = useQuery(api.teams.queries.list)
  const labels = useQuery(api.tasks.labels.queries.list)
  const competitions = useQuery(api.competitions.board.listForBoard)
  const phases = useQuery(api.phases.queries.list)

  const lookup = useMemo<TaskFilterLookup>(
    () => ({
      users: users ?? [],
      teams: teams ?? [],
      labels: labels ?? [],
      competitions: competitions ?? [],
      phases: phases ?? [],
    }),
    [competitions, labels, phases, teams, users]
  )

  const assigneeOptions = useMemo(
    () => lookup.users.map(userToFilterOption),
    [lookup.users]
  )

  const ownerOptions = useMemo<FilterOption[]>(() => {
    const userOptions = lookup.users.map(userToFilterOption).map((option) => ({
      ...option,
      value: `users:${option.value}`,
    }))
    const teamOptions: FilterOption[] = lookup.teams.map((team) => ({
      value: `teams:${team._id}`,
      label: team.name,
      icon: TargetIcon,
    }))
    return [
      { value: "unassigned", label: "Unassigned", icon: UserIcon },
      ...userOptions,
      ...teamOptions,
    ]
  }, [lookup.teams, lookup.users])

  const optionsByKey = useMemo<Record<TaskFilterKey, FilterOption[]>>(
    () => ({
      status: STATUS_OPTIONS,
      kind: KIND_OPTIONS,
      assignee: assigneeOptions,
      owner: ownerOptions,
      labels: lookup.labels.map((label) => ({
        value: label._id,
        label: label.name,
      })),
      competition: lookup.competitions.map((competition) => ({
        value: competition._id,
        label: competition.name,
        icon: TrophyIcon,
      })),
      phase: lookup.phases.map((phase) => ({
        value: phase._id,
        label: phase.name,
      })),
    }),
    [assigneeOptions, lookup.competitions, lookup.labels, lookup.phases, ownerOptions]
  )

  const filterTypes = useMemo(
    () =>
      TASK_FILTER_FIELDS.map((field) => ({
        id: field.id,
        label: field.label,
        icon: field.icon,
        options: optionsByKey[field.id],
      })),
    [optionsByKey]
  )

  const chipDefs = useMemo<ArrayFilterChipDef<TaskFilterKey>[]>(
    () =>
      TASK_FILTER_FIELDS.map((field) => ({
        key: field.id,
        label: field.label,
        icon: field.icon,
        renderValue: (value: string) =>
          renderTaskFilterValue(field.id, value, lookup),
      })),
    [lookup]
  )

  return { filterTypes, optionsByKey, chipDefs, lookup }
}
