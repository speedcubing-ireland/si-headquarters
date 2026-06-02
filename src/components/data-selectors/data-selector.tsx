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
import type { ComponentProps, ReactNode } from "react"
import {
  getSelectorOptionLabel,
  getSingleSelectorValue,
  isSelectorOptionEqual,
  type BuiltSelectorOptions,
  type SelectorOption,
  type SelectorOptionGroup,
} from "./selector-options"
import { SelectorButton, type SelectorButtonProps } from "./selector-face"
import type {
  MultipleSelectorModel,
  SingleSelectorModel,
} from "./data-selector-model"

import { SELECTOR_POPOVER_WIDTH } from "./selector-layout"

type SelectorContentAlign = ComponentProps<typeof ComboboxContent>["align"]
type DataSelectorButtonTriggerProps = Omit<SelectorButtonProps, "children">

function ignoreInputValueChange() {
  return undefined
}

export function SingleRoot<TItem, TValue>({
  children,
  model,
  onOpenChange,
  onValueChange,
  open,
  searchable,
}: {
  children: ReactNode
  model: SingleSelectorModel<TItem, TValue>
  onOpenChange?: (open: boolean) => void
  onValueChange: (value: TValue | null) => void
  open?: boolean
  searchable?: boolean
}) {
  return (
    <Combobox<SelectorOption<TItem, TValue>>
      items={model.rootItems}
      itemToStringLabel={getSelectorOptionLabel}
      isItemEqualToValue={isSelectorOptionEqual}
      open={open}
      inputValue={searchable === true ? undefined : ""}
      onInputValueChange={
        searchable === true ? undefined : ignoreInputValueChange
      }
      value={model.selectedOptions[0] ?? null}
      onOpenChange={onOpenChange}
      onValueChange={(option) => {
        onValueChange(getSingleSelectorValue(option))
      }}
    >
      {children}
    </Combobox>
  )
}

export function MultipleRoot<TItem, TValue>({
  children,
  model,
  onOpenChange,
  onValueChange,
  open,
  searchable,
}: {
  children: ReactNode
  model: MultipleSelectorModel<TItem, TValue>
  onOpenChange?: (open: boolean) => void
  onValueChange: (value: TValue[]) => void
  open?: boolean
  searchable?: boolean
}) {
  return (
    <Combobox<SelectorOption<TItem, TValue>, true>
      multiple
      items={model.rootItems}
      itemToStringLabel={getSelectorOptionLabel}
      isItemEqualToValue={isSelectorOptionEqual}
      open={open}
      inputValue={searchable === true ? undefined : ""}
      onInputValueChange={
        searchable === true ? undefined : ignoreInputValueChange
      }
      value={model.selectedOptions}
      onOpenChange={onOpenChange}
      onValueChange={(options) => {
        onValueChange(options.map((option) => option.value))
      }}
    >
      {children}
    </Combobox>
  )
}

export function ButtonTrigger({
  children,
  ...buttonProps
}: DataSelectorButtonTriggerProps & {
  children: ReactNode
}) {
  return (
    <ComboboxTrigger
      showChevron={false}
      render={<SelectorButton {...buttonProps} />}
    >
      {children}
    </ComboboxTrigger>
  )
}

export function PickRoot<TItem, TValue>({
  children,
  model,
  onOpenChange,
  onPick,
  open,
  searchable,
  searchQuery,
  onSearchChange,
  pending,
}: {
  children: ReactNode
  model: BuiltSelectorOptions<TItem, TValue>
  onOpenChange?: (open: boolean) => void
  onPick: (value: TValue) => void
  open?: boolean
  searchable?: boolean
  searchQuery?: string
  onSearchChange?: (query: string) => void
  pending?: boolean
}) {
  return (
    <Combobox<SelectorOption<TItem, TValue>>
      items={model.rootItems}
      itemToStringLabel={getSelectorOptionLabel}
      isItemEqualToValue={isSelectorOptionEqual}
      open={open}
      value={null}
      inputValue={searchable === true ? searchQuery : ""}
      onInputValueChange={
        searchable === true && onSearchChange !== undefined
          ? onSearchChange
          : ignoreInputValueChange
      }
      onOpenChange={onOpenChange}
      onValueChange={(option) => {
        if (option === null || pending === true) {
          return
        }
        onPick(option.value)
      }}
    >
      {children}
    </Combobox>
  )
}

export function PickContent<TItem, TValue>({
  align = "start",
  emptyMessage,
  loading,
  model,
  objectNoun,
  searchable,
}: {
  align?: SelectorContentAlign
  emptyMessage?: string
  loading?: boolean
  model: BuiltSelectorOptions<TItem, TValue>
  objectNoun: string
  searchable?: boolean
}) {
  return (
    <OptionsContent
      align={align}
      className={SELECTOR_POPOVER_WIDTH}
      emptyMessage={emptyMessage}
      loading={loading}
      model={model}
      objectNoun={objectNoun}
      searchable={searchable}
      showLoadingState
    />
  )
}

export function Content<TItem, TValue>({
  align = "end",
  clearLabel,
  model,
  objectNoun,
  searchable,
}: {
  align?: SelectorContentAlign
  clearLabel?: ReactNode
  model: BuiltSelectorOptions<TItem, TValue>
  objectNoun: string
  searchable?: boolean
}) {
  if (!model.hasLoadedItems) return null

  return (
    <OptionsContent
      align={align}
      className="w-64 p-0"
      clearLabel={clearLabel}
      model={model}
      objectNoun={objectNoun}
      searchable={searchable}
    />
  )
}

function OptionsContent<TItem, TValue>({
  align,
  className,
  clearLabel,
  emptyMessage,
  loading,
  model,
  objectNoun,
  searchable,
  showLoadingState,
}: {
  align: SelectorContentAlign
  className: string
  clearLabel?: ReactNode
  emptyMessage?: string
  loading?: boolean
  model: BuiltSelectorOptions<TItem, TValue>
  objectNoun: string
  searchable?: boolean
  showLoadingState?: boolean
}) {
  const hasOptions =
    model.itemGroups !== undefined
      ? model.itemGroups.some((group) => group.items.length > 0)
      : model.items.length > 0
  const shouldRenderOptions =
    model.hasLoadedItems && (showLoadingState !== true || hasOptions)

  return (
    <ComboboxContent className={className} align={align}>
      {searchable === true ? (
        <ComboboxInput
          placeholder={`Search ${objectNoun}...`}
          showClear={false}
          showTrigger={false}
        />
      ) : null}
      <ComboboxEmpty>
        {loading === true
          ? `Loading ${objectNoun}...`
          : (emptyMessage ?? `No ${objectNoun} found.`)}
      </ComboboxEmpty>
      {shouldRenderOptions ? (
        <ComboboxList>
          {clearLabel !== null && clearLabel !== undefined && (
            <>
              <ComboboxItem value={null}>{clearLabel}</ComboboxItem>
              <ComboboxSeparator />
            </>
          )}
          <OptionsCollection model={model} />
        </ComboboxList>
      ) : null}
    </ComboboxContent>
  )
}

function OptionsCollection<TItem, TValue>({
  model,
}: {
  model: BuiltSelectorOptions<TItem, TValue>
}) {
  if (model.itemGroups === undefined) {
    return <Collection<TItem, TValue> items={model.items} />
  }

  return (
    <ComboboxCollection>
      {(group: SelectorOptionGroup<TItem, TValue>) => (
        <ComboboxGroup key={group.key} items={group.items}>
          <ComboboxLabel>{group.label}</ComboboxLabel>
          <Collection<TItem, TValue> items={group.items} />
        </ComboboxGroup>
      )}
    </ComboboxCollection>
  )
}

interface CollectionProps<TItem, TValue> {
  items: SelectorOption<TItem, TValue>[]
}

function Collection<TItem, TValue>({ items }: CollectionProps<TItem, TValue>) {
  return (
    <ComboboxCollection data-option-count={items.length}>
      {(option: SelectorOption<TItem, TValue>) => (
        <ComboboxItem key={option.key} value={option}>
          {option.renderedItem}
        </ComboboxItem>
      )}
    </ComboboxCollection>
  )
}
