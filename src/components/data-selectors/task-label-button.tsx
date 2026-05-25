import { Badge } from "@/components/ui/badge"
import type { Button } from "@/components/ui/button"
import { MultipleSelectorCombobox } from "@/components/data-selectors/selector-combobox"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { TagIcon } from "lucide-react"
import { useState } from "react"

type TaskLabelOption = Pick<Doc<"taskLabels">, "_id" | "name">

function LabelBadge({ label }: { label: TaskLabelOption }) {
  return (
    <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
      {label.name}
    </Badge>
  )
}

function TaskLabelFace({ labels }: { labels: TaskLabelOption[] }) {
  if (labels.length === 0) {
    return (
      <>
        <TagIcon />
        None
      </>
    )
  }

  return labels
    .slice(0, 2)
    .map((label) => <LabelBadge key={label._id} label={label} />)
}

export function TaskLabelButton({
  size,
  selectedLabels,
  variant,
  value,
  onChange,
}: {
  size?: React.ComponentProps<typeof Button>["size"]
  selectedLabels?: TaskLabelOption[]
  variant?: React.ComponentProps<typeof Button>["variant"]
  value: Id<"taskLabels">[]
  onChange: (value: Id<"taskLabels">[]) => Promise<null> | undefined
}) {
  const [open, setOpen] = useState(false)
  const labels = useQuery(api.tasks.labels.queries.list, open ? {} : "skip")

  return (
    <MultipleSelectorCombobox
      items={labels}
      getLabel={(label) => label.name}
      getValue={(label) => label._id}
      getValueKey={(id) => id}
      objectNoun="labels"
      renderItem={(label) => <LabelBadge label={label} />}
      renderValue={(selectedLabels) => (
        <TaskLabelFace labels={selectedLabels} />
      )}
      open={open}
      searchable
      selectedItems={selectedLabels}
      size={size}
      variant={variant}
      values={value}
      onOpenChange={setOpen}
      onValueChange={(nextLabels) => void onChange(nextLabels)}
    />
  )
}
