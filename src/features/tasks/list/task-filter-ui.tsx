import { ArrayFilterChips } from "@/features/list-views/components/array-filter-chips"
import { DateRangeFilterChip } from "@/features/list-views/components/date-range-filter-chip"
import { FilterPopover } from "@/features/list-views/components/filter-popover"
import { hasDateRangeValue } from "@/features/list-views/types"
import { useTaskListPage } from "@/features/tasks/list/task-list-context"
import { countActiveTaskFilterChips } from "@/features/tasks/list/task-list-types"
import { useTaskFilters } from "@/features/tasks/list/task-filters"
import type { TaskBoardRow } from "@/features/tasks/task-inline-row"

export function TasksFilterPopover({
  rows,
}: {
  rows: TaskBoardRow[] | undefined
}) {
  const {
    editFilters,
    setEditArrayFilter,
    clearEditableFilters,
    hiddenFilterKeys,
  } = useTaskListPage()
  const { filterTypes } = useTaskFilters(rows)
  const visibleFilterTypes = filterTypes.filter(
    (type) => !hiddenFilterKeys.includes(type.id)
  )

  return (
    <FilterPopover
      filterTypes={visibleFilterTypes}
      filters={editFilters}
      setArrayFilter={setEditArrayFilter}
      clearFilters={clearEditableFilters}
      activeCount={countActiveTaskFilterChips(editFilters)}
    />
  )
}

export function TasksFilterChips({
  rows,
}: {
  rows: TaskBoardRow[] | undefined
}) {
  const {
    lockedFilters,
    editFilters,
    setEditArrayFilter,
    setEditDueDate,
    hiddenFilterKeys,
  } = useTaskListPage()
  const { optionsByKey, chipDefs } = useTaskFilters(rows)
  const visibleChipDefs = chipDefs.filter(
    (def) => !hiddenFilterKeys.includes(def.key)
  )

  const lockedDueDate =
    lockedFilters !== null && hasDateRangeValue(lockedFilters.dueDate)
      ? lockedFilters.dueDate
      : undefined
  const editDueDate = hasDateRangeValue(editFilters.dueDate)
    ? editFilters.dueDate
    : undefined

  return (
    <>
      {lockedFilters !== null ? (
        <ArrayFilterChips
          chipDefs={visibleChipDefs}
          filters={lockedFilters}
          optionsByKey={optionsByKey}
          setArrayFilter={setEditArrayFilter}
          readOnly
        />
      ) : null}
      {lockedDueDate ? (
        <DateRangeFilterChip
          label="Due date"
          dateRange={lockedDueDate}
          readOnly
        />
      ) : null}
      <ArrayFilterChips
        chipDefs={visibleChipDefs}
        filters={editFilters}
        optionsByKey={optionsByKey}
        setArrayFilter={setEditArrayFilter}
      />
      {editDueDate ? (
        <DateRangeFilterChip
          label="Due date"
          dateRange={editDueDate}
          onClear={() => {
            setEditDueDate(undefined)
          }}
          onToggleIsNot={() => {
            setEditDueDate({
              ...editDueDate,
              isNot: editDueDate.isNot !== true,
            })
          }}
        />
      ) : null}
    </>
  )
}
