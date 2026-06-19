import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { Id } from "@/convex/_generated/dataModel"
import { isCompetitionSponsorManualOverride } from "@/convex/plugins/sponsor/lib/competitionSponsorStatus"
import type { ManagerCompetition } from "@/plugins/sponsor/admin/manager-types"
import { competitionPropertyStatusLabel } from "@/plugins/sponsor/lib/sponsorship-ui"

export function CompetitionOverrideAlert({
  competition,
  manualSponsorName,
  busy,
  onRevert,
}: {
  competition: ManagerCompetition
  manualSponsorName: string | undefined
  busy: boolean
  onRevert: (competitionId: Id<"competitions">) => void
}) {
  if (!isCompetitionSponsorManualOverride(competition)) return null
  return (
    <Alert>
      <AlertTriangle className="size-4" />
      <AlertTitle>Manual sponsor override active</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Override:{" "}
          {competition.manualSponsorId
            ? (manualSponsorName ?? "Sponsor")
            : competitionPropertyStatusLabel(
                competition.manualSponsorPropertyStatus ?? "none"
              )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            onRevert(competition.id)
          }}
        >
          Revert override
        </Button>
      </AlertDescription>
    </Alert>
  )
}
