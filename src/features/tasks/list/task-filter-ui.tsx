import { ArrayFilterChips } from "@/features/list-views/components/array-filter-chips"
import { DateRangeFilterChip } from "@/features/list-views/components/date-range-filter-chip"
import { FilterPopover } from "@/features/list-views/components/filter-popover"
import { hasDateRangeValue } from "@/features/list-views/types"
import { useTaskListPage } from "@/features/tasks/list/task-list-context"
import { countActiveTaskFilterChips } from "@/features/tasks/list/task-list-types"
import { useTaskFilters } from "@/features/tasks/list/task-filters"

export function TasksFilterPopover() {
  const { overlayFilters, setArrayFilter, clearOverlay, hiddenFilterKeys } =
    useTaskListPage()
  const { filterTypes } = useTaskFilters()
  const visibleFilterTypes = filterTypes.filter(
    (type) => !hiddenFilterKeys.includes(type.id)
  )

  return (
    <FilterPopover
      filterTypes={visibleFilterTypes}
      filters={overlayFilters}
      setArrayFilter={setArrayFilter}
      clearFilters={clearOverlay}
      activeCount={countActiveTaskFilterChips(overlayFilters)}
    />
  )
}

export function TasksFilterChips() {
  const { overlayFilters, setArrayFilter, setDueDate, hiddenFilterKeys } =
    useTaskListPage()
  const { optionsByKey, chipDefs } = useTaskFilters()
  const visibleChipDefs = chipDefs.filter(
    (def) => !hiddenFilterKeys.includes(def.key)
  )

  if (countActiveTaskFilterChips(overlayFilters) === 0) return null

  const dueDate = overlayFilters.dueDate

  return (
    <>
      <ArrayFilterChips
        chipDefs={visibleChipDefs}
        filters={overlayFilters}
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
