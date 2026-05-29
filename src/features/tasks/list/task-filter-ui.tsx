import { ArrayFilterChips } from "@/features/list-views/components/array-filter-chips"
import { DateRangeFilterChip } from "@/features/list-views/components/date-range-filter-chip"
import { FilterPopover } from "@/features/list-views/components/filter-popover"
import { hasDateRangeValue } from "@/features/list-views/types"
import { useTaskListPage } from "@/features/tasks/list/task-list-context"
import {
  countActiveTaskFilterChips,
  hasActiveTaskFilters,
} from "@/features/tasks/list/task-list-types"
import { useTaskFilters } from "@/features/tasks/list/task-filters"

export function TasksFilterPopover() {
  const { filters, setArrayFilter, clearFilters } = useTaskListPage()
  const { filterTypes } = useTaskFilters()

  return (
    <FilterPopover
      filterTypes={filterTypes}
      filters={filters}
      setArrayFilter={setArrayFilter}
      clearFilters={clearFilters}
      activeCount={countActiveTaskFilterChips(filters)}
    />
  )
}

export function TasksFilterChips() {
  const { filters, setArrayFilter, setDueDate } = useTaskListPage()
  const { optionsByKey, chipDefs } = useTaskFilters()

  if (!hasActiveTaskFilters(filters)) return null

  const dueDate = filters.dueDate

  return (
    <>
      <ArrayFilterChips
        chipDefs={chipDefs}
        filters={filters}
        optionsByKey={optionsByKey}
        setArrayFilter={setArrayFilter}
      />
      {dueDate && hasDateRangeValue(dueDate) ? (
        <DateRangeFilterChip
          label="Due date"
          dateRange={dueDate}
          onClear={() => {
            setDueDate(undefined)
          }}
          onToggleIsNot={() => {
            setDueDate({
              ...dueDate,
              isNot: dueDate.isNot !== true,
            })
          }}
        />
      ) : null}
    </>
  )
}
