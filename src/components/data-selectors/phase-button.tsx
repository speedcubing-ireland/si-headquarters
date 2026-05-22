import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
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

type Phase = Doc<"phases">

type PhaseButtonProps = {
  owner: Phase["owner"]
  value: Id<"phases"> | null | undefined
  onChange: (value: Id<"phases">) => void
}

function PhaseDot({
  className = "",
  color,
}: {
  className?: string
  color: Phase["color"]
}) {
  return (
    <span
      className={`${className} rounded-full ${PHASE_COLOR_CLASSES[color]}`}
      aria-hidden="true"
    />
  )
}

const getPhaseName = (phase: Phase) => phase.name
const isSamePhase = (item: Phase, value: Phase) => item._id === value._id

export function PhaseButton({
  owner,
  onChange,
  value,
}: PhaseButtonProps) {
  const phases = useQuery(api.phases.queries.listForOwner, {
    owner,
  })
  const selectedPhase = phases?.find((phase) => phase._id === value)

  return (
    <Combobox<Phase>
      items={phases ?? []}
      itemToStringLabel={getPhaseName}
      isItemEqualToValue={isSamePhase}
      value={selectedPhase ?? null}
      onValueChange={(phase) => {
        if (phase) onChange(phase._id)
      }}
    >
      <ComboboxTrigger
        showChevron={false}
        render={<Button variant="outline" className="justify-start" />}
      >
        <PhaseDot className="size-3" color={selectedPhase?.color ?? "gray"} />
        <span className="truncate">{selectedPhase?.name ?? "No phase"}</span>
      </ComboboxTrigger>
      <ComboboxContent className="w-64 p-0" align="start">
        <ComboboxEmpty>
          {phases ? "No phases found." : "Loading phases..."}
        </ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(phase: Phase) => (
              <ComboboxItem key={phase._id} value={phase}>
                <PhaseDot className="size-2" color={phase.color} />
                <span className="truncate">{phase.name}</span>
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
