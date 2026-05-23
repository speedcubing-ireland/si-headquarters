import { SingleSelectorCombobox } from "@/components/data-selectors/selector-combobox"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useQuery } from "convex/react"

const PHASE_COLOR_CLASSES = {
  gray: "bg-gray-400 dark:bg-gray-600",
  red: "bg-red-500",
  sky: "bg-sky-500",
  amber: "bg-amber-400",
  green: "bg-green-600",
} satisfies Record<Doc<"phases">["color"], string>


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
  value,
}: {
  owner: Doc<"phases">["owner"]
  value: Id<"phases"> | null | undefined
  onChange: (value: Id<"phases">) => void
}) {
  const phases = useQuery(api.phases.queries.listForOwner, {
    owner,
  })

  return (
    <SingleSelectorCombobox
      align="start"
      items={phases}
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
      value={value ?? null}
      onValueChange={(phaseId) => {
        if (phaseId) onChange(phaseId)
      }}
    />
  )
}
