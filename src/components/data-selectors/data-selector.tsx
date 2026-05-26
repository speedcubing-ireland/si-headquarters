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
import { SelectorButton } from "./selector-face"
import type {
  MultipleSelectorModel,
  SingleSelectorModel,
} from "./data-selector-model"

type SelectorContentAlign = ComponentProps<typeof ComboboxContent>["align"]
type SelectorButtonProps = Omit<ComponentProps<typeof SelectorButton>, "children">

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
}: SelectorButtonProps & {
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
    <ComboboxContent className="w-64 p-0" align={align}>
      {searchable === true && (
        <ComboboxInput
          placeholder={`Search ${objectNoun}...`}
          showClear={false}
          showTrigger={false}
        />
      )}
      <ComboboxEmpty>{`No ${objectNoun} found.`}</ComboboxEmpty>
      <ComboboxList>
        {clearLabel !== null && clearLabel !== undefined && (
          <>
            <ComboboxItem value={null}>{clearLabel}</ComboboxItem>
            <ComboboxSeparator />
          </>
        )}
        {model.itemGroups !== undefined ? (
          <ComboboxCollection>
            {(group: SelectorOptionGroup<TItem, TValue>) => (
              <ComboboxGroup key={group.key} items={group.items}>
                <ComboboxLabel>{group.label}</ComboboxLabel>
                <Collection<TItem, TValue> items={group.items} />
              </ComboboxGroup>
            )}
          </ComboboxCollection>
        ) : (
          <Collection<TItem, TValue> items={model.items} />
        )}
      </ComboboxList>
    </ComboboxContent>
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
