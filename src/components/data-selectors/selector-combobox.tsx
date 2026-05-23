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
import type { ReactNode } from "react"
import type { SelectorGroup } from "./selector-groups"

type SelectorOption<TValue> = {
  item: unknown
  key: string
  label: string
  renderedItem: ReactNode
  value: TValue
}

type SelectorOptionGroup<TValue> = {
  items: SelectorOption<TValue>[]
  key: string
  label: string
}

type SelectorComboboxBaseProps<TItem, TValue> = {
  align?: React.ComponentProps<typeof ComboboxContent>["align"]
  className?: string
  getValueKey: (value: TValue) => string
  groups?: SelectorGroup<TValue>[]
  items?: TItem[]
  getLabel?: (item: TItem) => string
  getValue?: (item: TItem) => TValue
  objectNoun: string
  renderItem?: (item: TItem) => ReactNode
  searchable?: boolean
}

type SingleSelectorComboboxProps<TItem, TValue> = SelectorComboboxBaseProps<
  TItem,
  TValue
> & {
  clearLabel?: ReactNode
  onValueChange: (value: TValue | null) => void
  renderValue: (item: TItem | null) => ReactNode
  value: TValue | null | undefined
}

type MultipleSelectorComboboxProps<TItem, TValue> = SelectorComboboxBaseProps<
  TItem,
  TValue
> & {
  onValueChange: (value: TValue[]) => void
  renderValue: (items: TItem[]) => ReactNode
  values: TValue[]
}

function SelectorTrigger({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <ComboboxTrigger
      showChevron={false}
      render={
        <Button variant="outline" className={cn("justify-start", className)} />
      }
    >
      {children}
    </ComboboxTrigger>
  )
}

function normalizeItem<TValue>({
  getLabel,
  getValue,
  getValueKey,
  item,
  renderItem,
}: {
  getLabel: (item: unknown) => string
  getValue: (item: unknown) => TValue
  getValueKey: (value: TValue) => string
  item: unknown
  renderItem: (item: unknown) => ReactNode
}): SelectorOption<TValue> {
  const value = getValue(item)

  return {
    item,
    key: getValueKey(value),
    label: getLabel(item),
    renderedItem: renderItem(item),
    value,
  }
}

function useSelectorOptions<TItem, TValue>({
  getLabel,
  getValue,
  getValueKey,
  groups,
  items,
  renderItem,
}: Pick<
  SelectorComboboxBaseProps<TItem, TValue>,
  "getLabel" | "getValue" | "getValueKey" | "groups" | "items" | "renderItem"
>) {
  if (groups) {
    const optionGroups: SelectorOptionGroup<TValue>[] = groups.map((group) => ({
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
      itemGroups: optionGroups,
      items: optionGroups.flatMap((group) => group.items),
      rootItems: optionGroups,
    }
  }

  if (!getLabel || !getValue || !renderItem) {
    throw new Error("Flat selectors require getLabel, getValue, and renderItem")
  }

  const options = (items ?? []).map((item) =>
    normalizeItem({
      getLabel: getLabel as (item: unknown) => string,
      getValue: getValue as (item: unknown) => TValue,
      getValueKey,
      item,
      renderItem: renderItem as (item: unknown) => ReactNode,
    })
  )

  return {
    hasLoadedItems: items !== undefined,
    itemGroups: undefined,
    items: options,
    rootItems: options,
  }
}

function SelectorContent<TValue>({
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
  itemGroups?: SelectorOptionGroup<TValue>[]
  objectNoun: string
  searchable?: boolean
}) {
  return (
    <ComboboxContent className="w-64 p-0" align={align}>
      {searchable && (
        <ComboboxInput
          placeholder={`Search ${objectNoun}...`}
          showClear={false}
          showTrigger={false}
        />
      )}
      <ComboboxEmpty>
        {hasLoadedItems
          ? `No ${objectNoun} found.`
          : `Loading ${objectNoun}...`}
      </ComboboxEmpty>
      <ComboboxList>
        {clearLabel && (
          <>
            <ComboboxItem value={null}>{clearLabel}</ComboboxItem>
            <ComboboxSeparator />
          </>
        )}
        {itemGroups ? (
          <ComboboxCollection>
            {(group: SelectorOptionGroup<TValue>) => (
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

function SelectorCollection<TValue>() {
  return (
    <ComboboxCollection>
      {(option: SelectorOption<TValue>) => (
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
  renderValue,
  searchable,
  value,
  ...optionProps
}: SingleSelectorComboboxProps<TItem, TValue>) {
  const { hasLoadedItems, itemGroups, items, rootItems } = useSelectorOptions({
    getValueKey,
    ...optionProps,
  })
  const selectedOption =
    value === null || value === undefined
      ? null
      : (items.find((item) => item.key === getValueKey(value)) ?? null)

  return (
    <Combobox<SelectorOption<TValue>>
      items={rootItems}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(item, selected) => item.key === selected.key}
      value={selectedOption}
      onValueChange={(option) => onValueChange(option?.value ?? null)}
    >
      <SelectorTrigger className={className}>
        {renderValue((selectedOption?.item as TItem | undefined) ?? null)}
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
  renderValue,
  searchable,
  values,
  ...optionProps
}: MultipleSelectorComboboxProps<TItem, TValue>) {
  const { hasLoadedItems, itemGroups, items, rootItems } = useSelectorOptions({
    getValueKey,
    ...optionProps,
  })
  const valueKeys = new Set(values.map(getValueKey))
  const selectedOptions = items.filter((item) => valueKeys.has(item.key))

  return (
    <Combobox<SelectorOption<TValue>, true>
      multiple
      items={rootItems}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(item, selected) => item.key === selected.key}
      value={selectedOptions}
      onValueChange={(options) =>
        onValueChange(options.map((option) => option.value))
      }
    >
      <SelectorTrigger className={className}>
        {renderValue(selectedOptions.map((option) => option.item as TItem))}
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
