import type { SubmitEvent } from "react"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Id } from "@/convex/_generated/dataModel"
import type {
  ManagerCompetition,
  ManagerSponsor,
} from "@/plugins/sponsor/admin/manager-types"
import type { AuctionEditorDraft } from "@/plugins/sponsor/admin/auction-editor-draft"
import { AuctionFormFields } from "@/plugins/sponsor/admin/components/auction-form-fields"
import { CompetitionOverrideAlert } from "@/plugins/sponsor/admin/components/competition-override-alert"
import { competitionPropertyStatusLabel } from "@/plugins/sponsor/lib/sponsorship-ui"

export function AuctionCreateForm({
  isCreatingAuction,
  draft,
  onDraftChange,
  activeSponsors,
  createCompetitionId,
  unsponsoredCompetitionsByPhase,
  sponsoredCompetitions,
  competitionIdByString,
  selectedCompetition,
  busyCompetitionId,
  onCreateAuction,
  setCreateCompetitionIdSelection,
  onRevertCompetitionSponsorOverride,
  sponsorById,
}: {
  isCreatingAuction: boolean
  draft: AuctionEditorDraft
  onDraftChange: (patch: Partial<AuctionEditorDraft>) => void
  activeSponsors: ManagerSponsor[]
  createCompetitionId: Id<"competitions"> | null
  unsponsoredCompetitionsByPhase: {
    phase: string
    items: ManagerCompetition[]
  }[]
  sponsoredCompetitions: ManagerCompetition[]
  competitionIdByString: Map<string, Id<"competitions">>
  selectedCompetition: ManagerCompetition | null
  busyCompetitionId: Id<"competitions"> | null
  onCreateAuction: (event: SubmitEvent) => Promise<void>
  setCreateCompetitionIdSelection: (
    competitionId: Id<"competitions"> | null
  ) => void
  onRevertCompetitionSponsorOverride: (
    competitionId: Id<"competitions">
  ) => Promise<void>
  sponsorById: Map<Id<"sponsors">, ManagerSponsor>
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => void onCreateAuction(event)}
    >
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Competition</p>
        <Select
          value={
            createCompetitionId === null ? "" : String(createCompetitionId)
          }
          onValueChange={(value) => {
            setCreateCompetitionIdSelection(
              competitionIdByString.get(value) ?? null
            )
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select competition" />
          </SelectTrigger>
          <SelectContent>
            {unsponsoredCompetitionsByPhase.map((group) => (
              <SelectGroup key={group.phase}>
                <SelectLabel>Needs Sponsor - {group.phase}</SelectLabel>
                {group.items.map((competition) => (
                  <SelectItem key={competition.id} value={competition.id}>
                    {competition.name} ({competition.compStart})
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {sponsoredCompetitions.length > 0 ? (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Other competitions</SelectLabel>
                  {sponsoredCompetitions.map((competition) => (
                    <SelectItem key={competition.id} value={competition.id}>
                      {competition.name} ({competition.compStart})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            ) : null}
          </SelectContent>
        </Select>
        {selectedCompetition !== null ? (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">
              Phase: {selectedCompetition.currentPhaseName}
            </p>
            <p className="text-sm font-medium">{selectedCompetition.name}</p>
            <p className="text-xs text-muted-foreground">
              Dates: {selectedCompetition.compStart} -{" "}
              {selectedCompetition.compEnd}
            </p>
            <p className="text-xs text-muted-foreground">
              Sponsor status:{" "}
              {competitionPropertyStatusLabel(
                selectedCompetition.sponsorPropertyStatus
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedCompetition.wcaCompetitionId !== undefined &&
              selectedCompetition.wcaCompetitionId.length > 0
                ? "WCA link present. Full competition details will sync after draft creation."
                : "No WCA link yet. Full competition details cannot sync until linked."}
            </p>
            <CompetitionOverrideAlert
              competition={selectedCompetition}
              manualSponsorName={
                selectedCompetition.manualSponsorId
                  ? sponsorById.get(selectedCompetition.manualSponsorId)?.name
                  : undefined
              }
              busy={busyCompetitionId === selectedCompetition.id}
              onRevert={(competitionId) =>
                void onRevertCompetitionSponsorOverride(competitionId)
              }
            />
          </div>
        ) : null}
      </div>

      <AuctionFormFields
        draft={draft}
        onDraftChange={onDraftChange}
        activeSponsors={activeSponsors}
      />

      <Button type="submit" disabled={isCreatingAuction}>
        {isCreatingAuction ? <Spinner /> : "Create draft"}
      </Button>
    </form>
  )
}
