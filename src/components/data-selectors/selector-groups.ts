import type { ReactNode } from "react"

export type SelectorGroup<TValue> = {
  getLabel: (item: unknown) => string
  getValue: (item: unknown) => TValue
  items: unknown[] | undefined
  key: string
  label: string
  renderItem: (item: unknown) => ReactNode
}

type SelectorGroupInput<TItem, TValue> = {
  getLabel: (item: TItem) => string
  getValue: (item: TItem) => TValue
  items: TItem[] | undefined
  key: string
  label: string
  renderItem: (item: TItem) => ReactNode
}

export function selectorGroup<TItem, TValue>({
  getLabel,
  getValue,
  items,
  key,
  label,
  renderItem,
}: SelectorGroupInput<TItem, TValue>): SelectorGroup<TValue> {
  return {
    key,
    label,
    items,
    getLabel: (item) => getLabel(item as TItem),
    getValue: (item) => getValue(item as TItem),
    renderItem: (item) => renderItem(item as TItem),
  }
}
