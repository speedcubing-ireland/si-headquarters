import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { cn } from "@/lib/utils"
import { useMemo, type ReactNode } from "react"
import type { SelectorGroup } from "./selector-groups"

type SelectorOption<TItem, TValue> = {
  item: TItem
  key: string
  label: string
  renderedItem: ReactNode
  value: TValue
}

type SelectorOptionGroup<TItem, TValue> = {
  items: SelectorOption<TItem, TValue>[]
  key: string
  label: string
}

type SelectorAccessors<TItem, TValue> = {
  getLabel: (item: TItem) => string
  getValue: (item: TItem) => TValue
  renderItem: (item: TItem) => ReactNode
}

type FlatSelectorOptions<TItem, TValue> = SelectorAccessors<TItem, TValue> & {
  groups?: never
  items?: TItem[]
}

type GroupedSelectorOptions<TItem, TValue> = {
  getLabel?: never
  getValue?: never
  groups: SelectorGroup<TItem, TValue>[]
  items?: never
  renderItem?: never
}

type SelectorOptions<TItem, TValue> =
  | FlatSelectorOptions<TItem, TValue>
  | GroupedSelectorOptions<TItem, TValue>

type SelectorOptionsWithKey<TItem, TValue> = SelectorOptions<TItem, TValue> & {
  getValueKey: (value: TValue) => string
}

type SelectedItemOptions<TItem, TValue> = Partial<
  SelectorAccessors<TItem, TValue>
> & {
  groups?: SelectorGroup<TItem, TValue>[]
}

type SelectorComboboxBaseProps<TItem, TValue> = SelectorOptions<
  TItem,
  TValue
> & {
  align?: React.ComponentProps<typeof ComboboxContent>["align"]
  className?: string
  getValueKey: (value: TValue) => string
  objectNoun: string
  onOpenChange?: (open: boolean) => void
  open?: boolean
  searchable?: boolean
  size?: React.ComponentProps<typeof Button>["size"]
  variant?: React.ComponentProps<typeof Button>["variant"]
}

type SingleSelectorComboboxProps<TItem, TValue> = SelectorComboboxBaseProps<
  TItem,
  TValue
> & {
  clearLabel?: ReactNode
  onValueChange: (value: TValue | null) => void
  renderValue: (item: TItem | null) => ReactNode
  selectedItem?: TItem | null
  value: TValue | null | undefined
}

type MultipleSelectorComboboxProps<TItem, TValue> = SelectorComboboxBaseProps<
  TItem,
  TValue
> & {
  onValueChange: (value: TValue[]) => void
  renderValue: (items: TItem[]) => ReactNode
  selectedItems?: TItem[]
  values: TValue[]
}

function SelectorTrigger({
  children,
  className,
  size,
  variant,
}: {
  children: ReactNode
  className?: string
  size?: React.ComponentProps<typeof Button>["size"]
  variant?: React.ComponentProps<typeof Button>["variant"]
}) {
  return (
    <ComboboxTrigger
      showChevron={false}
      render={
        <Button
          variant={variant ?? "outline"}
          size={size}
          className={cn("justify-start", className)}
        />
      }
    >
      {children}
    </ComboboxTrigger>
  )
}

function normalizeItem<TItem, TValue>({
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

function getOptionLabel<TItem, TValue>(option: SelectorOption<TItem, TValue>) {
  return option.label
}

function isSelectorOptionEqual<TItem, TValue>(
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

function useSelectorOptions<TItem, TValue>(
  options: SelectorOptionsWithKey<TItem, TValue>
) {
  return useMemo(() => {
    if (hasSelectorGroups(options)) {
      const { getValueKey, groups } = options
      const itemGroups = groups.map((group) => ({
        key: group.key,
        label: group.label,
        items: (group.items ?? []).map((item) =>
          normalizeItem({
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
      normalizeItem({
        getLabel,
        getValue,
        getValueKey,
        item,
        renderItem,
      })
    )

    return {
      hasLoadedItems: items !== undefined,
      itemGroups: undefined,
      items: normalizedItems,
      rootItems: normalizedItems,
    }
  }, [options])
}

function optionFromSelectedItem<TItem, TValue>({
  getLabel,
  getValue,
  getValueKey,
  groups,
  item,
  renderItem,
}: SelectedItemOptions<TItem, TValue> & {
  getValueKey: (value: TValue) => string
  item: TItem
}) {
  if (hasGroups(groups)) {
    const group = groups.at(0)

    return group
      ? normalizeItem({
          getLabel: group.getLabel,
          getValue: group.getValue,
          getValueKey,
          item,
          renderItem: group.renderItem,
        })
      : null
  }

  if (!getLabel || !getValue || !renderItem) return null

  return normalizeItem({
    getLabel,
    getValue,
    getValueKey,
    item,
    renderItem,
  })
}

function useSelectedOptions<TItem, TValue>({
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
  return useMemo(() => {
    const resolvedValues =
      values ?? (value === null || value === undefined ? [] : [value])
    const fallbackItems = selectedItem ? [selectedItem] : selectedItems
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
      })

      if (
        option &&
        valueKeys.has(option.key) &&
        !selectedOptionsByKey.has(option.key)
      ) {
        selectedOptionsByKey.set(option.key, option)
      }
    }

    return resolvedValues
      .map((value) => selectedOptionsByKey.get(getValueKey(value)))
      .filter(
        (option): option is SelectorOption<TItem, TValue> =>
          option !== undefined
      )
  }, [
    availableOptions,
    getLabel,
    getValue,
    getValueKey,
    groups,
    renderItem,
    selectedItem,
    selectedItems,
    value,
    values,
  ])
}

function SelectorContent<TItem, TValue>({
  align = "end",
  clearLabel,
  hasLoadedItems,
  itemGroups,
  objectNoun,
  searchable,
}: {
  align?: React.ComponentProps<typeof ComboboxContent>["align"]
  clearLabel?: ReactNode
  hasLoadedItems: boolean
  itemGroups?: SelectorOptionGroup<TItem, TValue>[]
  objectNoun: string
  searchable?: boolean
}) {
  if (!hasLoadedItems) return <></>

  return (
    <ComboboxContent className="w-64 p-0" align={align}>
      {searchable && (
        <ComboboxInput
          placeholder={`Search ${objectNoun}...`}
          showClear={false}
          showTrigger={false}
        />
      )}
      <ComboboxEmpty>{`No ${objectNoun} found.`}</ComboboxEmpty>
      <ComboboxList>
        {clearLabel && (
          <>
            <ComboboxItem value={null}>{clearLabel}</ComboboxItem>
            <ComboboxSeparator />
          </>
        )}
        {itemGroups ? (
          <ComboboxCollection>
            {(group: SelectorOptionGroup<TItem, TValue>) => (
              <ComboboxGroup key={group.key} items={group.items}>
                <ComboboxLabel>{group.label}</ComboboxLabel>
                <SelectorCollection />
              </ComboboxGroup>
            )}
          </ComboboxCollection>
        ) : (
          <SelectorCollection />
        )}
      </ComboboxList>
    </ComboboxContent>
  )
}

function SelectorCollection<TItem, TValue>() {
  return (
    <ComboboxCollection>
      {(option: SelectorOption<TItem, TValue>) => (
        <ComboboxItem key={option.key} value={option}>
          {option.renderedItem}
        </ComboboxItem>
      )}
    </ComboboxCollection>
  )
}

export function SingleSelectorCombobox<TItem, TValue>({
  align,
  className,
  clearLabel,
  getValueKey,
  objectNoun,
  onValueChange,
  onOpenChange,
  open,
  renderValue,
  searchable,
  selectedItem,
  size,
  value,
  variant,
  ...optionProps
}: SingleSelectorComboboxProps<TItem, TValue>) {
  const { hasLoadedItems, itemGroups, items, rootItems } = useSelectorOptions({
    ...optionProps,
    getValueKey,
  })
  const selectedOptions = useSelectedOptions({
    ...optionProps,
    getValueKey,
    options: items,
    selectedItem,
    value,
  })
  const selectedItemValue = selectedOptions[0]?.item ?? null

  return (
    <Combobox<SelectorOption<TItem, TValue>>
      items={rootItems}
      itemToStringLabel={getOptionLabel}
      isItemEqualToValue={isSelectorOptionEqual}
      open={open}
      value={selectedOptions[0] ?? null}
      onOpenChange={onOpenChange}
      onValueChange={(option) => onValueChange(option?.value ?? null)}
    >
      <SelectorTrigger className={className} size={size} variant={variant}>
        {renderValue(selectedItemValue)}
      </SelectorTrigger>
      <SelectorContent
        align={align}
        clearLabel={clearLabel}
        hasLoadedItems={hasLoadedItems}
        itemGroups={itemGroups}
        objectNoun={objectNoun}
        searchable={searchable}
      />
    </Combobox>
  )
}

export function MultipleSelectorCombobox<TItem, TValue>({
  align,
  className,
  getValueKey,
  objectNoun,
  onValueChange,
  onOpenChange,
  open,
  renderValue,
  searchable,
  selectedItems,
  size,
  values,
  variant,
  ...optionProps
}: MultipleSelectorComboboxProps<TItem, TValue>) {
  const { hasLoadedItems, itemGroups, items, rootItems } = useSelectorOptions({
    ...optionProps,
    getValueKey,
  })
  const selectedOptions = useSelectedOptions({
    ...optionProps,
    getValueKey,
    options: items,
    selectedItems,
    values,
  })

  return (
    <Combobox<SelectorOption<TItem, TValue>, true>
      multiple
      items={rootItems}
      itemToStringLabel={getOptionLabel}
      isItemEqualToValue={isSelectorOptionEqual}
      open={open}
      value={selectedOptions}
      onOpenChange={onOpenChange}
      onValueChange={(options) =>
        onValueChange(options.map((option) => option.value))
      }
    >
      <SelectorTrigger className={className} size={size} variant={variant}>
        {renderValue(selectedOptions.map((option) => option.item))}
      </SelectorTrigger>
      <SelectorContent
        align={align}
        hasLoadedItems={hasLoadedItems}
        itemGroups={itemGroups}
        objectNoun={objectNoun}
        searchable={searchable}
      />
    </Combobox>
  )
}
