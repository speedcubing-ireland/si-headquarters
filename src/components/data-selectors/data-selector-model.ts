import {
  buildSelectorOptions,
  resolveSelectedOptions,
  type BuiltSelectorOptions,
  type SelectorOption,
  type SelectorOptions,
} from "./selector-options"

type BaseSelectorModelProps<TItem, TValue> = SelectorOptions<TItem, TValue> & {
  getValueKey: (value: TValue) => string
}

type SingleSelectorModelProps<TItem, TValue> = BaseSelectorModelProps<
  TItem,
  TValue
> & {
  selectedItem?: TItem | null
  value: TValue | null | undefined
}

type MultipleSelectorModelProps<TItem, TValue> = BaseSelectorModelProps<
  TItem,
  TValue
> & {
  selectedItems?: TItem[]
  values: TValue[]
}

export interface SingleSelectorModel<
  TItem,
  TValue,
> extends BuiltSelectorOptions<TItem, TValue> {
  selectedItem: TItem | null
  selectedOptions: SelectorOption<TItem, TValue>[]
}

export interface MultipleSelectorModel<
  TItem,
  TValue,
> extends BuiltSelectorOptions<TItem, TValue> {
  selectedItems: TItem[]
  selectedOptions: SelectorOption<TItem, TValue>[]
}

export function useSingleDataSelector<TItem, TValue>(
  props: SingleSelectorModelProps<TItem, TValue>
): SingleSelectorModel<TItem, TValue> {
  const builtOptions = buildSelectorOptions(props)
  const selectedOptions = resolveSelectedOptions({
    ...props,
    options: builtOptions.items,
  })

  return {
    ...builtOptions,
    selectedItem: selectedOptions[0]?.item ?? null,
    selectedOptions,
  }
}

export function useMultipleDataSelector<TItem, TValue>(
  props: MultipleSelectorModelProps<TItem, TValue>
): MultipleSelectorModel<TItem, TValue> {
  const builtOptions = buildSelectorOptions(props)
  const selectedOptions = resolveSelectedOptions({
    ...props,
    options: builtOptions.items,
  })

  return {
    ...builtOptions,
    selectedItems: selectedOptions.map((option) => option.item),
    selectedOptions,
  }
}
