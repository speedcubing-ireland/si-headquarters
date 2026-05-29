import type { FilterOption } from "@/features/list-views/components/filter-option-row"
import { FilterOptionRow } from "@/features/list-views/components/filter-option-row"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { LucideIcon } from "lucide-react"
import type { ReactElement } from "react"

function FilterOptionsList({
  label,
  options,
  selectedValues,
  onToggleValue,
  emptyMessage,
}: {
  label: string
  options: FilterOption[]
  selectedValues: string[]
  onToggleValue: (value: string) => void
  emptyMessage: string
}) {
  const labelLower = label.toLowerCase()

  return (
    <Command>
      <CommandInput placeholder={`Search ${labelLower}...`} />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {options.map((option) => (
            <FilterOptionRow
              key={option.value}
              option={option}
              isSelected={selectedValues.includes(option.value)}
              onSelect={() => onToggleValue(option.value)}
            />
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export function FilterSubMenu({
  icon: Icon,
  label,
  filterCount,
  options,
  selectedValues,
  onToggleValue,
}: {
  icon: LucideIcon
  label: string
  filterCount: number
  options: FilterOption[]
  selectedValues: string[]
  onToggleValue: (value: string) => void
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon className="size-4" />
        {label}
        {filterCount > 0 ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {filterCount}
          </span>
        ) : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-60 p-0">
        <FilterOptionsList
          label={label}
          options={options}
          selectedValues={selectedValues}
          onToggleValue={onToggleValue}
          emptyMessage="No results."
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

export function FilterValueSelector({
  label,
  options,
  selectedValues,
  onToggleValue,
  children,
}: {
  label: string
  options: FilterOption[]
  selectedValues: string[]
  onToggleValue: (value: string) => void
  children: ReactElement
}) {
  const labelLower = label.toLowerCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-60 p-0" align="start">
        <FilterOptionsList
          label={label}
          options={options}
          selectedValues={selectedValues}
          onToggleValue={onToggleValue}
          emptyMessage={`No ${labelLower} found.`}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
