import {
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  TaskStatusIcon,
} from "@/features/tasks/status"
import { LabelBadge } from "@/components/data-selectors/task-label-badge"
import { ObjectAvatar } from "@/components/object-avatar"
import type { FilterOption } from "@/features/list-views/components/filter-option-row"
import type { ArrayFilterChipDef } from "@/features/list-views/components/array-filter-chips"
import {
  matchesFilterItems,
  matchesPointInDateRange,
} from "@/features/list-views/filter-engine"
import { hasDateRangeValue } from "@/features/list-views/types"
import type { MatchMode } from "@/features/list-views/types"
import {
  emptyOverlayFilters,
  hasOverlayFilters,
  mergeScopeFilters,
  type TaskListScope,
} from "@/features/tasks/list/task-list-config"
import type {
  TaskFilterKey,
  TasksFilters,
} from "@/features/tasks/list/task-list-types"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"
import { isTaskStatus } from "@/convex/tasks/status/validators"
import type { Doc } from "@/convex/_generated/dataModel"
import type { PublicUser } from "@/convex/users/validators"
import {
  BanIcon,
  CassetteTapeIcon,
  CircleDotIcon,
  ClipboardCheckIcon,
  TagIcon,
  TargetIcon,
  TrophyIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"
import { useMemo, type ReactNode } from "react"

type UserListEntry = PublicUser

export type TaskRowFilterInput = Pick<
  TaskBoardRow,
  | "statusView"
  | "task"
  | "assignees"
  | "owner"
  | "labels"
  | "dependencyStatuses"
  | "pendingReviewerTeams"
  | "competitionId"
  | "competitionName"
  | "phaseId"
  | "phaseName"
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
      row.assignees.mode === "assigned"
        ? row.assignees.userIds
        : ["unassigned"],
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
  {
    id: "dependency",
    label: "Dependencies",
    icon: BanIcon,
    getRowValues: (row) => row.dependencyStatuses,
  },
  {
    id: "pendingTeamApproval",
    label: "Pending team approvals",
    icon: ClipboardCheckIcon,
    getRowValues: (row) => row.pendingReviewerTeams.map((t) => t._id),
  },
]

const STATUS_OPTIONS: FilterOption[] = TASK_STATUS_ORDER.map((status) => ({
  value: status,
  label: TASK_STATUS_META[status].label,
  taskStatus: status,
}))

const KIND_OPTIONS: FilterOption[] = [
  { value: "standard", label: "Standard", icon: CircleDotIcon },
  { value: "flow", label: "Flow", icon: CassetteTapeIcon },
]

const DEPENDENCY_OPTIONS: FilterOption[] = [
  { value: "blocking", label: "Blocking", icon: BanIcon },
  { value: "blocked", label: "Blocked", icon: BanIcon },
  { value: "no-dependencies", label: "No dependencies", icon: CircleDotIcon },
]

function userToFilterOption(user: UserListEntry): FilterOption {
  return {
    value: user._id,
    label: user.name ?? "Unknown",
    avatar: { name: user.name ?? "?", image: user.image ?? null },
  }
}

function sortByName(left: { name: string }, right: { name: string }) {
  return left.name.localeCompare(right.name)
}

function uniqueLookupValues(
  rows: TaskBoardRow[] | undefined
): TaskFilterLookup {
  const users = new Map<string, UserListEntry>()
  const teams = new Map<string, { _id: string; name: string }>()
  const labels = new Map<
    string,
    Pick<Doc<"taskLabels">, "_id" | "code" | "name" | "color">
  >()
  const competitions = new Map<string, { _id: string; name: string }>()
  const phases = new Map<string, { _id: string; name: string }>()
  const pendingTeamApprovals = new Map<string, { _id: string; name: string }>()

  for (const row of rows ?? []) {
    for (const user of row.assignees.users) {
      users.set(user._id, user)
    }
    if (row.owner?.type === "users") {
      users.set(row.owner._id, row.owner)
    }
    if (row.owner?.type === "teams") {
      teams.set(row.owner._id, row.owner)
    }
    for (const label of row.labels) {
      labels.set(label._id, label)
    }
    if (row.competitionId !== null && row.competitionName !== null) {
      competitions.set(row.competitionId, {
        _id: row.competitionId,
        name: row.competitionName,
      })
    }
    if (row.phaseId !== null && row.phaseName !== null) {
      phases.set(row.phaseId, { _id: row.phaseId, name: row.phaseName })
    }
    for (const team of row.pendingReviewerTeams) {
      pendingTeamApprovals.set(team._id, team)
    }
  }

  return {
    users: [...users.values()].sort((left, right) =>
      (left.name ?? "").localeCompare(right.name ?? "")
    ),
    teams: [...teams.values()].sort(sortByName),
    labels: [...labels.values()].sort(sortByName),
    competitions: [...competitions.values()].sort(sortByName),
    phases: [...phases.values()].sort(sortByName),
    pendingTeamApprovals: [...pendingTeamApprovals.values()].sort(sortByName),
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
      matchesFilterItems(filters[field.id], field.getRowValues(row), matchMode)
    )

    if (hasDueDate && filters.dueDate) {
      matchers.push(matchesPointInDateRange(row.task.dueDate, filters.dueDate))
    }

    return matchMode === "all"
      ? matchers.every(Boolean)
      : matchers.some(Boolean)
  })
}

export function filterTaskRowsForListPage<TRow extends TaskRowFilterInput>({
  rows,
  scope,
  viewFilters,
  viewMatchMode,
  overlayFilters,
  overlayMatchMode,
}: {
  rows: TRow[]
  scope: TaskListScope
  viewFilters: TasksFilters
  viewMatchMode: MatchMode
  overlayFilters: TasksFilters
  overlayMatchMode: MatchMode
}): TRow[] {
  const scoped = filterTaskRows(
    rows,
    mergeScopeFilters(scope, emptyOverlayFilters()),
    "all"
  )
  const viewRows = filterTaskRows(scoped, viewFilters, viewMatchMode)
  return hasOverlayFilters(overlayFilters)
    ? filterTaskRows(viewRows, overlayFilters, overlayMatchMode)
    : viewRows
}

export interface TaskFilterLookup {
  users: UserListEntry[]
  teams: { _id: string; name: string }[]
  labels: Pick<Doc<"taskLabels">, "_id" | "code" | "name" | "color">[]
  competitions: { _id: string; name: string }[]
  phases: { _id: string; name: string }[]
  pendingTeamApprovals: { _id: string; name: string }[]
}

function renderTaskFilterValue(
  key: TaskFilterKey,
  value: string,
  lookup: TaskFilterLookup
): ReactNode {
  switch (key) {
    case "status": {
      if (!isTaskStatus(value)) return value
      return (
        <span className="flex items-center gap-1 text-xs">
          <TaskStatusIcon status={value} size="sm" />
          {TASK_STATUS_META[value].label}
        </span>
      )
    }
    case "kind":
      return <span className="text-xs font-medium capitalize">{value}</span>
    case "assignee": {
      if (value === "unassigned") return "Unassigned"
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
    case "labels": {
      const label = lookup.labels.find((entry) => entry._id === value)
      return label ? <LabelBadge label={label} /> : value
    }
    case "competition":
      return (
        lookup.competitions.find((entry) => entry._id === value)?.name ?? value
      )
    case "phase":
      return lookup.phases.find((entry) => entry._id === value)?.name ?? value
    case "dependency":
      return (
        DEPENDENCY_OPTIONS.find((option) => option.value === value)?.label ??
        value
      )
    case "pendingTeamApproval":
      return (
        lookup.pendingTeamApprovals.find((team) => team._id === value)?.name ??
        value
      )
    default:
      return value
  }
}

export function useTaskFilters(rows: TaskBoardRow[] | undefined) {
  const lookup = useMemo<TaskFilterLookup>(
    () => uniqueLookupValues(rows),
    [rows]
  )

  const assigneeOptions = useMemo<FilterOption[]>(
    () => [
      { value: "unassigned", label: "Unassigned", icon: UserIcon },
      ...lookup.users.map(userToFilterOption),
    ],
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
      dependency: DEPENDENCY_OPTIONS,
      pendingTeamApproval: lookup.pendingTeamApprovals.map((team) => ({
        value: team._id,
        label: team.name,
        icon: ClipboardCheckIcon,
      })),
    }),
    [
      assigneeOptions,
      lookup.competitions,
      lookup.labels,
      lookup.pendingTeamApprovals,
      lookup.phases,
      ownerOptions,
    ]
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
