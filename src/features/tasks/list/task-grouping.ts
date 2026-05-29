import { TASK_STATUS_META } from "@/components/data-selectors/task-status-meta"
import type { ItemGroup } from "@/features/list-views/group-items"
import { groupItems } from "@/features/list-views/group-items"
import type { DisplaySettings } from "@/features/list-views/types"
import { taskStatusRank } from "@/features/tasks/list/task-sort"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"

function resolveTaskGroup(
  row: TaskBoardRow,
  grouping: string
): { key: string; title: string } {
  switch (grouping) {
    case "status":
      return {
        key: row.statusView.effectiveStatus,
        title: TASK_STATUS_META[row.statusView.effectiveStatus].label,
      }
    case "kind":
      return {
        key: row.task.kind,
        title: row.task.kind === "flow" ? "Flow" : "Standard",
      }
    case "assignee": {
      const primary = row.assignees.primaryUser
      const key =
        row.assignees.mode === "assigned" && primary
          ? primary._id
          : row.assignees.mode
      const title =
        row.assignees.mode === "assigned" && primary
          ? (primary.name ?? "Assigned")
          : row.assignees.mode === "assignable"
            ? "Assignable"
            : "Unassigned"
      return { key, title }
    }
    case "owner":
      if (!row.owner) return { key: "unassigned", title: "No owner" }
      return {
        key: `${row.owner.type}:${row.owner._id}`,
        title:
          row.owner.type === "users"
            ? (row.owner.name ?? "User")
            : row.owner.name,
      }
    case "competition": {
      const key = row.competitionId ?? "none"
      return {
        key,
        title: key === "none" ? "No competition" : (row.competitionName ?? key),
      }
    }
    case "phase": {
      const key = row.phaseId ?? "none"
      return {
        key,
        title: key === "none" ? "No phase" : (row.phaseName ?? key),
      }
    }
    case "name":
      return { key: row.task.name, title: row.task.name }
    case "dueDate": {
      const key = row.task.dueDate ?? "none"
      return { key, title: key === "none" ? "No due date" : key }
    }
    default:
      return { key: "all", title: "All" }
  }
}

export function groupTaskRows(
  rows: TaskBoardRow[],
  display: DisplaySettings
): ItemGroup<TaskBoardRow>[] {
  const groups = groupItems(rows, display.grouping, resolveTaskGroup)

  if (display.grouping !== "status") {
    return groups
  }

  return [...groups].sort(
    (left, right) => taskStatusRank(left.key) - taskStatusRank(right.key)
  )
}
