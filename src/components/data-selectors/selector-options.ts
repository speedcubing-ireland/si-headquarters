import type { ReactNode } from "react"

export interface SelectorOption<TItem, TValue> {
  item: TItem
  key: string
  label: string
  renderedItem: ReactNode
  value: TValue
}

export interface SelectorOptionGroup<TItem, TValue> {
  items: SelectorOption<TItem, TValue>[]
  key: string
  label: string
}

export interface SelectorAccessors<TItem, TValue> {
  getLabel: (item: TItem) => string
  getValue: (item: TItem) => TValue
  renderItem: (item: TItem) => ReactNode
}

export interface SelectorGroup<TItem, TValue> extends SelectorAccessors<
  TItem,
  TValue
> {
  items: TItem[] | undefined
  key: string
  label: string
}

export type FlatSelectorOptions<TItem, TValue> = SelectorAccessors<
  TItem,
  TValue
> & {
  groups?: never
  items?: TItem[]
}

export interface GroupedSelectorOptions<TItem, TValue> {
  getLabel?: never
  getValue?: never
  groups: SelectorGroup<TItem, TValue>[]
  items?: never
  renderItem?: never
}

export type SelectorOptions<TItem, TValue> =
  | FlatSelectorOptions<TItem, TValue>
  | GroupedSelectorOptions<TItem, TValue>

export type SelectorChangeHandler<TValue> = (value: TValue) => void

export type SelectorOptionsWithKey<TItem, TValue> = SelectorOptions<
  TItem,
  TValue
> & {
  getValueKey: (value: TValue) => string
}

export interface BuiltSelectorOptions<TItem, TValue> {
  hasLoadedItems: boolean
  itemGroups?: SelectorOptionGroup<TItem, TValue>[]
  items: SelectorOption<TItem, TValue>[]
  rootItems:
    | SelectorOption<TItem, TValue>[]
    | SelectorOptionGroup<TItem, TValue>[]
}

type SelectedItemOptions<TItem, TValue> = Partial<
  SelectorAccessors<TItem, TValue>
> & {
  groups?: SelectorGroup<TItem, TValue>[]
}

export function normalizeSelectorItem<TItem, TValue>({
  getLabel,
  getValue,
  getValueKey,
  item,
  renderItem,
}: SelectorAccessors<TItem, TValue> & {
  getValueKey: (value: TValue) => string
  item: TItem
}): SelectorOption<TItem, TValue> {
  const value = getValue(item)

  return {
    item,
    key: getValueKey(value),
    label: getLabel(item),
    renderedItem: renderItem(item),
    value,
  }
}

export function getSelectorOptionLabel<TItem, TValue>(
  option: SelectorOption<TItem, TValue>
) {
  return option.label
}

export function isSelectorOptionEqual<TItem, TValue>(
  item: SelectorOption<TItem, TValue>,
  selected: SelectorOption<TItem, TValue>
) {
  return item.key === selected.key
}

function hasGroups<TItem, TValue>(
  groups: SelectorGroup<TItem, TValue>[] | undefined
): groups is SelectorGroup<TItem, TValue>[] {
  return groups !== undefined
}

function hasSelectorGroups<TItem, TValue>(
  options: SelectorOptionsWithKey<TItem, TValue>
): options is GroupedSelectorOptions<TItem, TValue> & {
  getValueKey: (value: TValue) => string
} {
  return options.groups !== undefined
}

export function buildSelectorOptions<TItem, TValue>(
  options: SelectorOptionsWithKey<TItem, TValue>
): BuiltSelectorOptions<TItem, TValue> {
  if (hasSelectorGroups(options)) {
    const { getValueKey, groups } = options
    const itemGroups = groups.map((group) => ({
      key: group.key,
      label: group.label,
      items: (group.items ?? []).map((item) =>
        normalizeSelectorItem({
          getLabel: group.getLabel,
          getValue: group.getValue,
          getValueKey,
          item,
          renderItem: group.renderItem,
        })
      ),
    }))

    return {
      hasLoadedItems: groups.every((group) => group.items !== undefined),
      itemGroups,
      items: itemGroups.flatMap((group) => group.items),
      rootItems: itemGroups,
    }
  }

  const { getLabel, getValue, getValueKey, items, renderItem } = options
  const normalizedItems = (items ?? []).map((item) =>
    normalizeSelectorItem({
      getLabel,
      getValue,
      getValueKey,
      item,
      renderItem,
    })
  )

  return {
    hasLoadedItems: items !== undefined,
    items: normalizedItems,
    rootItems: normalizedItems,
  }
}

function optionFromSelectedItem<TItem, TValue>({
  getLabel,
  getValue,
  getValueKey,
  groups,
  item,
  renderItem,
  valueKeys,
}: SelectedItemOptions<TItem, TValue> & {
  getValueKey: (value: TValue) => string
  item: TItem
  valueKeys: Set<string>
}) {
  if (hasGroups(groups)) {
    for (const group of groups) {
      const option = normalizeSelectorItem({
        getLabel: group.getLabel,
        getValue: group.getValue,
        getValueKey,
        item,
        renderItem: group.renderItem,
      })

      if (valueKeys.has(option.key)) {
        return option
      }
    }

    return null
  }

  if (!getLabel || !getValue || !renderItem) return null

  return normalizeSelectorItem({
    getLabel,
    getValue,
    getValueKey,
    item,
    renderItem,
  })
}

export function resolveSelectedOptions<TItem, TValue>({
  getLabel,
  getValue,
  getValueKey,
  groups,
  options: availableOptions,
  renderItem,
  selectedItem,
  selectedItems = [],
  value,
  values,
}: SelectedItemOptions<TItem, TValue> & {
  getValueKey: (value: TValue) => string
  options: SelectorOption<TItem, TValue>[]
  selectedItem?: TItem | null
  selectedItems?: TItem[]
  value?: TValue | null
  values?: TValue[]
}) {
  const resolvedValues =
    values ?? (value === null || value === undefined ? [] : [value])
  const fallbackItems =
    selectedItem !== null && selectedItem !== undefined
      ? [selectedItem]
      : selectedItems
  const valueKeys = new Set(resolvedValues.map(getValueKey))
  const selectedOptionsByKey = new Map(
    availableOptions
      .filter((option) => valueKeys.has(option.key))
      .map((option) => [option.key, option])
  )

  for (const item of fallbackItems) {
    const option = optionFromSelectedItem({
      getLabel,
      getValue,
      getValueKey,
      groups,
      item,
      renderItem,
      valueKeys,
    })

    if (
      option !== null &&
      valueKeys.has(option.key) &&
      !selectedOptionsByKey.has(option.key)
    ) {
      selectedOptionsByKey.set(option.key, option)
    }
  }

  return resolvedValues
    .map((selectedValue) =>
      selectedOptionsByKey.get(getValueKey(selectedValue))
    )
    .filter(
      (option): option is SelectorOption<TItem, TValue> => option !== undefined
    )
}

export function getSingleSelectorValue<TItem, TValue>(
  option: SelectorOption<TItem, TValue> | null | undefined
): TValue | null {
  return option?.value ?? null
}
