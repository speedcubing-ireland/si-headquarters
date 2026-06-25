import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { IconLabelToolbarButton } from "@/components/ui/icon-label-toolbar-button"
import type { SubtaskDisplayOptions } from "@/features/subtasks/subtask-display-storage"
import { SquareDashedKanbanIcon } from "lucide-react"
import { useId } from "react"

export function SubtaskDisplayOptionsPopover({
  className,
  options,
  onChange,
}: {
  className?: string
  options: SubtaskDisplayOptions
  onChange: (options: SubtaskDisplayOptions) => void
}) {
  const hideCompletedId = useId()
  const hideSubtasksId = useId()
  const hasActiveOptions = options.hideCompleted || options.hideSubtasks

  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconLabelToolbarButton
          className={className}
          icon={SquareDashedKanbanIcon}
          label="Display"
          variant={hasActiveOptions ? "secondary" : "outline"}
        />
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <PopoverHeader>
          <PopoverTitle>Display</PopoverTitle>
        </PopoverHeader>
        <div className="flex flex-col gap-1">
          <div className="flex min-h-9 items-center gap-3 rounded-md px-1.5">
            <Switch
              id={hideCompletedId}
              checked={options.hideCompleted}
              onCheckedChange={(hideCompleted) => {
                onChange({ ...options, hideCompleted })
              }}
            />
            <Label htmlFor={hideCompletedId} className="flex-1">
              Hide completed
            </Label>
          </div>
          <div className="flex min-h-9 items-center gap-3 rounded-md px-1.5">
            <Switch
              id={hideSubtasksId}
              checked={options.hideSubtasks}
              onCheckedChange={(hideSubtasks) => {
                onChange({ ...options, hideSubtasks })
              }}
            />
            <Label htmlFor={hideSubtasksId} className="flex-1">
              Hide subtasks
            </Label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
