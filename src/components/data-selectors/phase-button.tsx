import { SingleSelectorCombobox } from "@/components/data-selectors/selector-combobox"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { useState } from "react"
import { PHASE_COLOR_CLASSES } from "./phase-meta"

function PhaseDot({
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

export function PhaseButton({
  owner,
  onChange,
  selectedPhase,
  value,
}: {
  owner: Doc<"phases">["owner"]
  selectedPhase?: Doc<"phases"> | null
  value: Id<"phases"> | null | undefined
  onChange: (value: Id<"phases">) => void
}) {
  const [open, setOpen] = useState(false)
  const phases = useQuery(
    api.phases.queries.listForOwner,
    open ? { owner } : "skip"
  )
  
  return (
    <SingleSelectorCombobox
      align="start"
      items={phases}
      open={open}
      getLabel={(phase) => phase.name}
      getValue={(phase) => phase._id}
      getValueKey={(id) => id}
      objectNoun="phases"
      renderItem={(phase) => (
        <>
          <PhaseDot className="size-2" color={phase.color} />
          <span className="truncate">{phase.name}</span>
        </>
      )}
      renderValue={(phase) => (
        <>
          <PhaseDot className="size-3" color={phase?.color ?? "gray"} />
          <span className="truncate">{phase?.name ?? "No phase"}</span>
        </>
      )}
      selectedItem={selectedPhase}
      value={value ?? null}
      onOpenChange={setOpen}
      onValueChange={(phaseId) => {
        if (phaseId) onChange(phaseId)
      }}
    />
  )
}
