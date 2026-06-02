import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { TagIcon } from "lucide-react"
import {
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react"
import * as DataSelector from "./data-selector"
import { useMultipleDataSelector } from "./data-selector-model"
import * as SelectorFace from "./selector-face"
import {
  LabelBadge,
  LabelCountBadge,
  LabelListTooltip,
} from "./task-label-badge"
import type { TaskLabelOption } from "./task-label-display"
import type { SelectorChangeHandler } from "./selector-options"

type SelectorButtonProps = ComponentProps<typeof DataSelector.ButtonTrigger>

interface TaskLabelSelectorProps extends Pick<
  SelectorButtonProps,
  "className" | "disabled" | "size" | "variant"
> {
  displayText?: ReactNode
  selectedLabels?: TaskLabelOption[]
  showSelectedLabelsTooltip?: boolean
  value: Id<"taskLabels">[]
  onChange: SelectorChangeHandler<Id<"taskLabels">[]>
}

export function Face({
  displayText,
  labels,
}: {
  displayText?: ReactNode
  labels: TaskLabelOption[]
}) {
  if (labels.length === 0) {
    return <SelectorFace.Empty icon={TagIcon}>None</SelectorFace.Empty>
  }

  if (labels.length > 1) {
    return (
      <SelectorFace.Badges>
        <LabelCountBadge count={labels.length}>{displayText}</LabelCountBadge>
      </SelectorFace.Badges>
    )
  }

  const [label] = labels

  return (
    <SelectorFace.Badges>
      <LabelBadge label={label}>{displayText}</LabelBadge>
    </SelectorFace.Badges>
  )
}

function TaskLabelSelectorControl({
  className,
  disabled,
  displayText,
  onChange,
  selectedLabels,
  showSelectedLabelsTooltip,
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
      <LabelSelectorTrigger
        labels={model.selectedItems}
        showTooltip={showSelectedLabelsTooltip}
      >
        <DataSelector.ButtonTrigger
          className={className}
          disabled={disabled}
          size={size}
          variant={variant}
        >
          <Face displayText={displayText} labels={model.selectedItems} />
        </DataSelector.ButtonTrigger>
      </LabelSelectorTrigger>
      <DataSelector.Content model={model} objectNoun="labels" searchable />
    </DataSelector.MultipleRoot>
  )
}

function LabelSelectorTrigger({
  children,
  labels,
  showTooltip,
}: {
  children: ReactElement
  labels: TaskLabelOption[]
  showTooltip?: boolean
}) {
  if (labels.length === 0 || (labels.length < 2 && showTooltip !== true)) {
    return children
  }

  return <LabelListTooltip labels={labels}>{children}</LabelListTooltip>
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
