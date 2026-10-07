import type { Id } from "@/convex/_generated/dataModel"
import { TASK_STATUSES } from "@/convex/tasks/status/validators"
import { matchesFilterItems } from "@/features/list-views/filter-engine"
import type { MatchMode } from "@/features/list-views/types"
import type { TasksFilters } from "@/features/tasks/list/task-list-types"

/** Push only constraints every matching row must satisfy into the loading query.
 * OR views cannot be narrowed by just one field; overlays remain client-side so
 * editing them doesn't resubscribe to the board on every interaction.
 */
export function taskBoardQueryFilters(
  filters: TasksFilters,
  matchMode: MatchMode,
  userId: Id<"users"> | null
) {
  if (matchMode !== "all") return {}
  const assignedToMe =
    userId !== null &&
    filters.assignee.some(
      (item) =>
        !item.isNot && item.values.length === 1 && item.values[0] === userId
    )
  return {
    ...(assignedToMe ? { assignedToMe: true } : {}),
    ...(filters.status.length > 0
      ? {
          effectiveStatuses: TASK_STATUSES.filter((status) =>
            matchesFilterItems(filters.status, [status], "all")
          ),
        }
      : {}),
  }
}
