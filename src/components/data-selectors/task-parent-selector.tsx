import { api } from "@/convex/_generated/api"
import type {
  SubtaskViewOwner,
  TaskSubtaskView,
  TaskCreationTargetSection,
} from "@/convex/tasks/queries"
import { objectRefKey } from "@/lib/utils"
import { useQuery } from "convex/react"
import { CassetteTapeIcon, CircleDotIcon, GitBranchIcon } from "lucide-react"
import { useDeferredValue, useMemo, useState, type ComponentProps } from "react"
import * as DataSelector from "./data-selector"
import { useSingleDataSelector } from "./data-selector-model"
import { Dot as PhaseDot } from "./phase-selector"
import * as SelectorFace from "./selector-face"
import type { SelectorChangeHandler, SelectorGroup } from "./selector-options"

type SelectorButtonProps = ComponentProps<typeof DataSelector.ButtonTrigger>
type TaskParentRef = NonNullable<TaskSubtaskView["defaultParent"]>
type PhaseTarget = NonNullable<TaskCreationTargetSection["phase"]> & {
  targetType: "phases"
}
type TaskTarget = TaskCreationTargetSection["tasks"][number] & {
  targetType: "tasks"
}
type ParentTarget = PhaseTarget | TaskTarget

const TASK_KIND_ICONS = {
  standard: CircleDotIcon,
  flow: CassetteTapeIcon,
} as const satisfies Record<TaskTarget["kind"], typeof CircleDotIcon>

function TaskKindIcon({
  className,
  kind,
}: {
  className?: string
  kind: TaskTarget["kind"]
}) {
  const Icon = TASK_KIND_ICONS[kind]
  return <Icon className={className} />
}

interface TaskParentSelectorProps extends Pick<
  SelectorButtonProps,
  "className" | "disabled" | "variant"
> {
  enabled: boolean
  scope: SubtaskViewOwner
  value: TaskParentRef | null
  onChange: SelectorChangeHandler<TaskParentRef | null>
}

function parentTargetValue(target: ParentTarget): TaskParentRef {
  if (target.targetType === "phases") {
    return { type: "phases", id: target._id }
  }

  return { type: "tasks", id: target._id }
}

function sectionParentTargets(
  section: TaskCreationTargetSection
): ParentTarget[] {
  const targets: ParentTarget[] = []

  if (section.phase !== null) {
    targets.push({ ...section.phase, targetType: "phases" })
  }

  for (const task of section.tasks) {
    targets.push({ ...task, targetType: "tasks" })
  }

  return targets
}

function phaseOwnerName(target: PhaseTarget) {
  return target.competitionName ?? target.projectName ?? "Project"
}

function getParentTargetLabel(target: ParentTarget) {
  if (target.targetType === "phases") {
    return `${phaseOwnerName(target)} ${target.name}`
  }

  return `${target.sectionTitle} ${target.name}`
}

function renderPhaseTarget(target: PhaseTarget) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <PhaseDot className="size-2.5 shrink-0" color={target.color} />
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate">{target.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {phaseOwnerName(target)}
        </span>
      </span>
    </div>
  )
}

function renderTaskTarget(target: TaskTarget) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <TaskKindIcon
        kind={target.kind}
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <span className="truncate" title={target.name}>
        {target.name}
      </span>
    </div>
  )
}

function renderParentTarget(target: ParentTarget) {
  return target.targetType === "phases"
    ? renderPhaseTarget(target)
    : renderTaskTarget(target)
}

function Face({ target }: { target: ParentTarget | null }) {
  if (target?.targetType === "phases") {
    return (
      <SelectorFace.Root>
        <PhaseDot className="size-3" color={target.color} />
        <SelectorFace.Text>{target.name}</SelectorFace.Text>
      </SelectorFace.Root>
    )
  }

  if (target?.targetType === "tasks") {
    return (
      <SelectorFace.Root>
        <TaskKindIcon kind={target.kind} className="size-4" />
        <SelectorFace.Text>{target.name}</SelectorFace.Text>
      </SelectorFace.Root>
    )
  }

  return (
    <SelectorFace.Empty icon={GitBranchIcon}>Select parent</SelectorFace.Empty>
  )
}

export function PropertyButton({
  className,
  disabled,
  enabled,
  onChange,
  scope,
  value,
  variant,
}: TaskParentSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const targets = useQuery(
    api.tasks.queries.listCreationTargets,
    enabled
      ? { scope, search: deferredSearchQuery, selectedParent: value }
      : "skip"
  )
  const groups = useMemo<SelectorGroup<ParentTarget, TaskParentRef>[]>(
    () =>
      targets?.sections.map((section) => ({
        key: section.id,
        label: section.title,
        items: sectionParentTargets(section),
        getLabel: getParentTargetLabel,
        getValue: parentTargetValue,
        renderItem: renderParentTarget,
      })) ?? [],
    [targets?.sections]
  )
  const model = useSingleDataSelector<ParentTarget, TaskParentRef>({
    getValueKey: objectRefKey,
    groups,
    value,
  })

  return (
    <DataSelector.SingleRoot
      model={model}
      open={open}
      searchable
      searchQuery={searchQuery}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setSearchQuery("")
      }}
      onSearchChange={setSearchQuery}
      onValueChange={onChange}
    >
      <DataSelector.ButtonTrigger
        className={className}
        disabled={disabled}
        variant={variant}
      >
        <Face target={model.selectedItem} />
      </DataSelector.ButtonTrigger>
      <DataSelector.Content
        align="start"
        loading={targets === undefined}
        model={model}
        objectNoun="parents"
        searchable
      />
    </DataSelector.SingleRoot>
  )
}
