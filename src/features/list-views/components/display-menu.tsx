import { Button } from "@/components/ui/button"
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DisplaySettings } from "@/features/list-views/types"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LayoutList,
  SquareDashedKanban,
} from "lucide-react"

export interface DisplayColumnOption {
  value: string
  label: string
}

function ColumnSelect({
  value,
  options,
  onChange,
}: {
  value: string | null
  options: DisplayColumnOption[]
  onChange: (value: string | null) => void
}) {
  return (
    <Select
      value={value ?? "none"}
      onValueChange={(next) => { onChange(next === "none" ? null : next); }}
    >
      <SelectTrigger className="w-28">
        <SelectValue placeholder="None" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function DisplayMenu({
  display,
  columnOptions,
  onChange,
}: {
  display: DisplaySettings
  columnOptions: DisplayColumnOption[]
  onChange: (display: DisplaySettings) => void
}) {
  const { field, direction } = display.ordering

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <SquareDashedKanban className="size-4" />
          Display
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[min(16rem,calc(100vw-1rem))] sm:w-64"
        align="end"
      >
        <DropdownMenuLabel>Display</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <LayoutList className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Mode</span>
            <ButtonGroup>
              {(["list", "kanban"] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={display.mode === mode ? "secondary" : "outline"}
                  size="sm"
                  type="button"
                  className="capitalize"
                  onClick={() => { onChange({ ...display, mode }); }}
                >
                  {mode}
                </Button>
              ))}
            </ButtonGroup>
          </div>

          <div className="flex items-center gap-2 px-2 py-1.5">
            <SquareDashedKanban className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Grouping</span>
            <ColumnSelect
              value={display.grouping}
              options={columnOptions}
              onChange={(grouping) => { onChange({ ...display, grouping }); }}
            />
          </div>

          <div className="flex items-center gap-2 px-2 py-1.5">
            <ArrowUpDown className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Ordering</span>
            <ButtonGroup>
              <ColumnSelect
                value={field}
                options={columnOptions}
                onChange={(nextField) =>
                  { onChange({
                    ...display,
                    ordering: { field: nextField, direction },
                  }); }
                }
              />
              {field !== null ? (
                <>
                  <ButtonGroupSeparator orientation="vertical" />
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    onClick={() =>
                      { onChange({
                        ...display,
                        ordering: {
                          field,
                          direction: direction === "asc" ? "desc" : "asc",
                        },
                      }); }
                    }
                  >
                    {direction === "asc" ? (
                      <ArrowUp className="size-4" />
                    ) : (
                      <ArrowDown className="size-4" />
                    )}
                  </Button>
                </>
              ) : null}
            </ButtonGroup>
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
