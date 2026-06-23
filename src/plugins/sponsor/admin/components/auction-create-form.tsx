import type { SubmitEvent } from "react"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Id } from "@/convex/_generated/dataModel"
import type {
  ManagerCompetition,
  ManagerSponsor,
} from "@/plugins/sponsor/admin/manager-types"
import type { AuctionEditorDraft } from "@/plugins/sponsor/admin/auction-editor-draft"
import type { AuctionSubjectDraft } from "@/plugins/sponsor/admin/auction-subject-draft"
import { AuctionFormFields } from "@/plugins/sponsor/admin/components/auction-form-fields"
import { AuctionSubjectPicker } from "@/plugins/sponsor/admin/components/auction-subject-picker"

export function AuctionCreateForm({
  isCreatingAuction,
  draft,
  onDraftChange,
  subjectDraft,
  onSubjectDraftChange,
  activeSponsors,
  competitions,
  unsponsoredCompetitionsByPhase,
  sponsoredCompetitions,
  competitionIdByString,
  selectedCompetition,
  busyCompetitionId,
  onCreateAuction,
  onRevertCompetitionSponsorOverride,
  sponsorById,
}: {
  isCreatingAuction: boolean
  draft: AuctionEditorDraft
  onDraftChange: (patch: Partial<AuctionEditorDraft>) => void
  subjectDraft: AuctionSubjectDraft
  onSubjectDraftChange: (patch: Partial<AuctionSubjectDraft>) => void
  activeSponsors: ManagerSponsor[]
  competitions: ManagerCompetition[]
  unsponsoredCompetitionsByPhase: {
    phase: string
    items: ManagerCompetition[]
  }[]
  sponsoredCompetitions: ManagerCompetition[]
  competitionIdByString: Map<string, Id<"competitions">>
  selectedCompetition: ManagerCompetition | null
  busyCompetitionId: Id<"competitions"> | null
  onCreateAuction: (event: SubmitEvent) => Promise<void>
  onRevertCompetitionSponsorOverride: (
    competitionId: Id<"competitions">
  ) => Promise<void>
  sponsorById: Map<Id<"sponsors">, ManagerSponsor>
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => void onCreateAuction(event)}
    >
      <Card>
        <CardHeader>
          <CardTitle>Auction subject</CardTitle>
          <CardDescription>
            Choose the competition or offering this auction is for.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuctionSubjectPicker
            draft={subjectDraft}
            onDraftChange={onSubjectDraftChange}
            competitions={competitions}
            competitionIdByString={competitionIdByString}
            unsponsoredCompetitionsByPhase={unsponsoredCompetitionsByPhase}
            sponsoredCompetitions={sponsoredCompetitions}
            selectedCompetition={selectedCompetition}
            busyCompetitionId={busyCompetitionId}
            onRevertCompetitionSponsorOverride={
              onRevertCompetitionSponsorOverride
            }
            sponsorById={sponsorById}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auction settings</CardTitle>
          <CardDescription>
            Set the schedule, starting price, and invited sponsors.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <AuctionFormFields
            draft={draft}
            onDraftChange={onDraftChange}
            activeSponsors={activeSponsors}
          />

          <Button type="submit" disabled={isCreatingAuction}>
            {isCreatingAuction ? <Spinner /> : "Create draft"}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
