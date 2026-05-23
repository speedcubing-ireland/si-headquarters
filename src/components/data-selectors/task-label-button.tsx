import { Badge } from "@/components/ui/badge"
import { MultipleSelectorCombobox } from "@/components/data-selectors/selector-combobox"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { TagIcon } from "lucide-react"

function LabelBadge({ label }: { label: Doc<"taskLabels"> }) {
  return (
    <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
      {label.name}
    </Badge>
  )
}

function TaskLabelFace({ labels }: { labels: Doc<"taskLabels">[] }) {
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
  value,
  onChange,
}: {
  value: Id<"taskLabels">[]
  onChange: (value: Id<"taskLabels">[]) => void | Promise<void> | Promise<null>
}) {
  const labels = useQuery(api.taskLabels.queries.list)

  return (
    <MultipleSelectorCombobox
      items={labels}
      getLabel={(label: Doc<"taskLabels">) => label.name}
      getValue={(label: Doc<"taskLabels">) => label._id}
      getValueKey={(id: Id<"taskLabels">) => id}
      objectNoun="labels"
      renderItem={(label: Doc<"taskLabels">) => <LabelBadge label={label} />}
      renderValue={(selectedLabels) => (
        <TaskLabelFace labels={selectedLabels} />
      )}
      searchable
      values={value}
      onValueChange={(nextLabels) => void onChange(nextLabels)}
    />
  )
}
