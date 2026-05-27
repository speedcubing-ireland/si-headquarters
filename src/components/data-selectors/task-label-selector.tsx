import { Badge } from "@/components/ui/badge"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { TagIcon } from "lucide-react"
import { useState, type ComponentProps } from "react"
import * as DataSelector from "./data-selector"
import { useMultipleDataSelector } from "./data-selector-model"
import * as SelectorFace from "./selector-face"
import type { SelectorChangeHandler } from "./selector-options"

type TaskLabelOption = Pick<Doc<"taskLabels">, "_id" | "name">
type SelectorButtonProps = ComponentProps<typeof DataSelector.ButtonTrigger>

interface TaskLabelSelectorProps extends Pick<
  SelectorButtonProps,
  "className" | "disabled" | "size" | "variant"
> {
  selectedLabels?: TaskLabelOption[]
  value: Id<"taskLabels">[]
  onChange: SelectorChangeHandler<Id<"taskLabels">[]>
}

export function LabelBadge({ label }: { label: TaskLabelOption }) {
  return (
    <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
      {label.name}
    </Badge>
  )
}

export function Face({ labels }: { labels: TaskLabelOption[] }) {
  if (labels.length === 0) {
    return <SelectorFace.Empty icon={TagIcon}>None</SelectorFace.Empty>
  }

  return (
    <SelectorFace.Badges>
      {labels.slice(0, 2).map((label) => (
        <LabelBadge key={label._id} label={label} />
      ))}
    </SelectorFace.Badges>
  )
}

function TaskLabelSelectorControl({
  className,
  disabled,
  onChange,
  selectedLabels,
  size,
  value,
  variant,
}: TaskLabelSelectorProps) {
  const [open, setOpen] = useState(false)
  const labels = useQuery(api.tasks.labels.queries.list, open ? {} : "skip")
  const model = useMultipleDataSelector<TaskLabelOption, Id<"taskLabels">>({
    getLabel: (label) => label.name,
    getValue: (label) => label._id,
    getValueKey: (id) => id,
    items: labels,
    renderItem: (label) => <LabelBadge label={label} />,
    selectedItems: selectedLabels,
    values: value,
  })

  return (
    <DataSelector.MultipleRoot
      model={model}
      open={open}
      searchable
      onOpenChange={setOpen}
      onValueChange={(labelIds) => {
        onChange(labelIds)
      }}
    >
      <DataSelector.ButtonTrigger
        className={className}
        disabled={disabled}
        size={size}
        variant={variant}
      >
        <Face labels={model.selectedItems} />
      </DataSelector.ButtonTrigger>
      <DataSelector.Content model={model} objectNoun="labels" searchable />
    </DataSelector.MultipleRoot>
  )
}

export function PropertyButton(props: TaskLabelSelectorProps) {
  return <TaskLabelSelectorControl {...props} />
}

export function CompactButton({
  size = "sm",
  ...props
}: TaskLabelSelectorProps) {
  return <TaskLabelSelectorControl size={size} {...props} />
}
