import type { FilterItem } from "@/features/list-views/types"

export type ArrayFilterSetter<K extends string> = (
  key: K,
  value: FilterItem[]
) => void

function updateFilterItemAt<K extends string>(
  setArrayFilter: ArrayFilterSetter<K>,
  type: K,
  items: FilterItem[],
  index: number,
  updater: (item: FilterItem) => FilterItem | null
) {
  const item = items.at(index)
  if (item === undefined) return

  const updated = updater(item)
  setArrayFilter(
    type,
    updated === null
      ? items.filter((_, itemIndex) => itemIndex !== index)
      : items.map((entry, itemIndex) => (itemIndex === index ? updated : entry))
  )
}

export function toggleFilter<K extends string>(
  filters: Record<K, FilterItem[]>,
  setArrayFilter: ArrayFilterSetter<K>,
  type: K,
  value: string
) {
  const items = filters[type]
  const index = items.findIndex((item) => item.values.includes(value))

  if (index < 0) {
    setArrayFilter(type, [...items, { values: [value], isNot: false }])
    return
  }

  const nextValues = items[index].values.filter((entry) => entry !== value)
  if (nextValues.length === 0) {
    setArrayFilter(
      type,
      items.filter((_, itemIndex) => itemIndex !== index)
    )
    return
  }

  updateFilterItemAt(setArrayFilter, type, items, index, (item) => ({
    ...item,
    values: nextValues,
  }))
}

export function toggleFilterValue<K extends string>(
  filters: Record<K, FilterItem[]>,
  setArrayFilter: ArrayFilterSetter<K>,
  type: K,
  filterIndex: number,
  value: string
) {
  updateFilterItemAt(
    setArrayFilter,
    type,
    filters[type],
    filterIndex,
    (item) => {
      const nextValues = item.values.includes(value)
        ? item.values.filter((entry) => entry !== value)
        : [...item.values, value]
      return nextValues.length === 0 ? null : { ...item, values: nextValues }
    }
  )
}

export function removeFilterAt<K extends string>(
  setArrayFilter: ArrayFilterSetter<K>,
  type: K,
  items: FilterItem[],
  index: number
) {
  setArrayFilter(
    type,
    items.filter((_, itemIndex) => itemIndex !== index)
  )
}

export function toggleFilterIsNot<K extends string>(
  filters: Record<K, FilterItem[]>,
  setArrayFilter: ArrayFilterSetter<K>,
  type: K,
  filterIndex: number
) {
  updateFilterItemAt(
    setArrayFilter,
    type,
    filters[type],
    filterIndex,
    (item) => ({ ...item, isNot: !item.isNot })
  )
}
