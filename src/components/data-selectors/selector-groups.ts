import type { ReactNode } from "react"

export interface SelectorGroup<TItem, TValue> {
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
}: SelectorGroup<TItem, TValue>): SelectorGroup<TItem, TValue> {
  return {
    key,
    label,
    items,
    getLabel,
    getValue,
    renderItem,
  }
}
