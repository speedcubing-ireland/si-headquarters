import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { useState, type ComponentProps } from "react"
import * as DataSelector from "./data-selector"
import { useSingleDataSelector } from "./data-selector-model"
import * as SelectorFace from "./selector-face"
import { PHASE_COLOR_CLASSES } from "./phase-meta"
import type { SelectorChangeHandler } from "./selector-options"

type SelectorButtonProps = ComponentProps<typeof DataSelector.ButtonTrigger>

interface PhaseSelectorProps extends Pick<
  SelectorButtonProps,
  "className" | "disabled" | "size" | "variant"
> {
  owner: Doc<"phases">["owner"]
  selectedPhase?: Doc<"phases"> | null
  value: Id<"phases"> | null | undefined
  onChange: SelectorChangeHandler<Id<"phases">>
}

export function Dot({
  className = "",
  color,
}: {
  className?: string
  color: Doc<"phases">["color"]
}) {
  return (
    <span
      className={`${className} rounded-full ${PHASE_COLOR_CLASSES[color]}`}
      aria-hidden="true"
    />
  )
}

export function Face({ phase }: { phase: Doc<"phases"> | null }) {
  return (
    <SelectorFace.Root>
      <Dot className="size-3" color={phase?.color ?? "gray"} />
      <SelectorFace.Text>{phase?.name ?? "No phase"}</SelectorFace.Text>
    </SelectorFace.Root>
  )
}

function renderPhaseItem(phase: Doc<"phases">) {
  return (
    <>
      <Dot className="size-2" color={phase.color} />
      <span className="truncate">{phase.name}</span>
    </>
  )
}

export function PropertyButton({
  className,
  disabled,
  onChange,
  owner,
  selectedPhase,
  size,
  value,
  variant,
}: PhaseSelectorProps) {
  const [open, setOpen] = useState(false)
  const phases = useQuery(
    api.phases.queries.listForOwner,
    open ? { owner } : "skip"
  )
  const model = useSingleDataSelector<Doc<"phases">, Id<"phases">>({
    getLabel: (phase) => phase.name,
    getValue: (phase) => phase._id,
    getValueKey: (id) => id,
    items: phases,
    renderItem: renderPhaseItem,
    selectedItem: selectedPhase,
    value: value ?? null,
  })

  return (
    <DataSelector.SingleRoot
      model={model}
      open={open}
      onOpenChange={setOpen}
      onValueChange={(phaseId) => {
        if (phaseId !== null) {
          onChange(phaseId)
        }
      }}
    >
      <DataSelector.ButtonTrigger
        className={className}
        disabled={disabled}
        size={size}
        variant={variant}
      >
        <Face phase={model.selectedItem} />
      </DataSelector.ButtonTrigger>
      <DataSelector.Content align="start" model={model} objectNoun="phases" />
    </DataSelector.SingleRoot>
  )
}
