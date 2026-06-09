import * as PhaseSelector from "@/components/data-selectors/phase-selector"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import type { CompetitionOrProjectRef } from "@/convex/utils"
import { PageCardRow } from "@/components/page-card"
import { MilestoneIcon } from "lucide-react"

export function PhasePropertyRow({
  disabled,
  owner,
  phaseId,
  selectedPhase,
  onChange,
}: {
  disabled?: boolean
  owner: CompetitionOrProjectRef
  phaseId: Id<"phases"> | null
  selectedPhase: Doc<"phases"> | null
  onChange: (phaseId: Id<"phases">) => void
}) {
  return (
    <PageCardRow icon={<MilestoneIcon className="size-4" />} label="Phase">
      <PhaseSelector.PropertyButton
        owner={owner}
        selectedPhase={selectedPhase}
        value={phaseId}
        disabled={disabled}
        onChange={onChange}
      />
    </PageCardRow>
  )
}
