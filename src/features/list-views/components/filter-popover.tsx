import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { FilterOption } from "@/features/list-views/components/filter-option-row"
import { FilterSubMenu } from "@/features/list-views/components/filter-options-menu"
import { toggleFilter } from "@/features/list-views/filter-handlers"
import type { ArrayFilterSetter } from "@/features/list-views/filter-handlers"
import type { FilterItem } from "@/features/list-views/types"
import { ChevronDown, ListFilter, type LucideIcon } from "lucide-react"
import { useState } from "react"

export type FilterTypeConfig<K extends string> = {
  id: K
  label: string
  icon: LucideIcon
  options: FilterOption[]
}

export function FilterPopover<K extends string>({
  filterTypes,
  filters,
  setArrayFilter,
  clearFilters,
  activeCount,
}: {
  filterTypes: FilterTypeConfig<K>[]
  filters: Record<K, FilterItem[]>
  setArrayFilter: ArrayFilterSetter<K>
  clearFilters: () => void
  activeCount: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" type="button" className="h-9 gap-1 sm:h-8">
          <ListFilter className="size-4" />
          <span>Filter</span>
          {activeCount > 0 ? (
            <Badge variant="default" className="ml-1 px-1.5 py-0 text-[10px]">
              {activeCount}
            </Badge>
          ) : null}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[min(15rem,calc(100vw-1rem))]"
        align="start"
      >
        <DropdownMenuGroup>
          {filterTypes.map((filterType) => (
            <FilterSubMenu
              key={filterType.id}
              icon={filterType.icon}
              label={filterType.label}
              filterCount={filters[filterType.id].length}
              options={filterType.options}
              selectedValues={filters[filterType.id].flatMap((item) => item.values)}
              onToggleValue={(value) => {
                toggleFilter(filters, setArrayFilter, filterType.id, value)
              }}
            />
          ))}
        </DropdownMenuGroup>
        {activeCount > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                clearFilters()
                setOpen(false)
              }}
            >
              Clear all filters
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
