import { FilterChip } from "@/features/list-views/components/filter-chip"
import type { FilterOption } from "@/features/list-views/components/filter-option-row"
import { FilterValueSelector } from "@/features/list-views/components/filter-options-menu"
import {
  removeFilterAt,
  toggleFilterIsNot,
  toggleFilterValue,
} from "@/features/list-views/filter-handlers"
import type { ArrayFilterSetter } from "@/features/list-views/filter-handlers"
import type { FilterItem } from "@/features/list-views/types"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export type ArrayFilterChipDef<K extends string> = {
  key: K
  label: string
  icon: LucideIcon
  renderValue: (value: string) => ReactNode
}

export function ArrayFilterChips<K extends string>({
  chipDefs,
  filters,
  optionsByKey,
  setArrayFilter,
}: {
  chipDefs: ArrayFilterChipDef<K>[]
  filters: Record<K, FilterItem[]>
  optionsByKey: Record<K, FilterOption[]>
  setArrayFilter: ArrayFilterSetter<K>
}) {
  return (
    <>
      {chipDefs.flatMap(({ key, label, icon, renderValue }) =>
        filters[key].map((item, index) => (
          <FilterChip
            key={`${key}-${item.values.join(",")}-${String(index)}`}
            icon={icon}
            label={label}
            values={item.values}
            isNot={item.isNot}
            onToggleIsNot={() => {
              toggleFilterIsNot(filters, setArrayFilter, key, index)
            }}
            onRemove={() => {
              removeFilterAt(setArrayFilter, key, filters[key], index)
            }}
            renderValue={renderValue}
            wrapValueButton={(button) => (
              <FilterValueSelector
                label={label}
                options={optionsByKey[key]}
                selectedValues={item.values}
                onToggleValue={(value) => {
                  toggleFilterValue(filters, setArrayFilter, key, index, value)
                }}
              >
                {button}
              </FilterValueSelector>
            )}
          />
        ))
      )}
    </>
  )
}
