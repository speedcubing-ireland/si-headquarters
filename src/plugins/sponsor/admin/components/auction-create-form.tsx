import { AlertTriangle, Lock, LockOpen } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
import type { SponsorshipAdmin } from "@/plugins/sponsor/admin/use-sponsorship-admin"
import {
  SPONSORSHIP_FRAMEWORKS,
  competitionPropertyStatusLabel,
  isSponsorshipFramework,
  sponsorshipFrameworkLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui"

export function AuctionCreateForm({ admin }: { admin: SponsorshipAdmin }) {
  const { open, actions, maps } = admin
  const {
    isCreatingAuction,
    createCompetitionId,
    createStartsAtInput,
    setCreateStartsAtInput,
    createEndsAtInput,
    setCreateEndsAtInput,
    createFramework,
    setCreateFramework,
    isCreateFrameworkUnlocked,
    setIsCreateFrameworkUnlocked,
    createStartPriceEuros,
    setCreateStartPriceEuros,
    createInvitedSponsorIds,
    activeSponsors,
    unsponsoredCompetitionsByPhase,
    sponsoredCompetitions,
    competitionIdByString,
    selectedCompetition,
    busyCompetitionId,
  } = open
  const {
    onCreateAuction,
    toggleCreateSponsorInvite,
    setCreateCompetitionIdSelection,
    onRevertCompetitionSponsorOverride,
  } = actions
  const { sponsorById } = maps

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
            {selectedCompetition.manualSponsorPropertyStatus !== undefined ||
            selectedCompetition.manualSponsorId !== undefined ? (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertTitle>Manual sponsor override active</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    Override:{" "}
                    {selectedCompetition.manualSponsorId
                      ? (sponsorById.get(selectedCompetition.manualSponsorId)
                          ?.name ?? "Sponsor")
                      : competitionPropertyStatusLabel(
                          selectedCompetition.manualSponsorPropertyStatus ??
                            "none"
                        )}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyCompetitionId === selectedCompetition.id}
                    onClick={() =>
                      void onRevertCompetitionSponsorOverride(
                        selectedCompetition.id
                      )
                    }
                  >
                    Revert override
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Auction type</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              setIsCreateFrameworkUnlocked((current) => !current)
            }}
          >
            {isCreateFrameworkUnlocked ? (
              <LockOpen className="size-3.5" />
            ) : (
              <Lock className="size-3.5" />
            )}
            <span className="sr-only">
              {isCreateFrameworkUnlocked
                ? "Lock auction type"
                : "Unlock auction type"}
            </span>
          </Button>
        </div>
        <Select
          value={createFramework}
          onValueChange={(value) => {
            if (!isSponsorshipFramework(value)) return
            setCreateFramework(value)
          }}
          disabled={!isCreateFrameworkUnlocked}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select auction type">
              {sponsorshipFrameworkLabel(createFramework)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SPONSORSHIP_FRAMEWORKS.map((framework) => (
              <SelectItem key={framework} value={framework}>
                {sponsorshipFrameworkLabel(framework)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 @md/main:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Start price (EUR)</p>
          <Input
            type="number"
            min="1"
            step="0.01"
            value={createStartPriceEuros}
            onChange={(event) => {
              setCreateStartPriceEuros(event.target.value)
            }}
            required
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Starts at</p>
          <Input
            type="datetime-local"
            value={createStartsAtInput}
            onChange={(event) => {
              setCreateStartsAtInput(event.target.value)
            }}
            required
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Ends at</p>
          <Input
            type="datetime-local"
            value={createEndsAtInput}
            onChange={(event) => {
              setCreateEndsAtInput(event.target.value)
            }}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Invited sponsors</p>
        <div className="grid gap-2 @md/main:grid-cols-2">
          {activeSponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="flex items-center gap-2 rounded border px-2 py-1.5"
            >
              <Checkbox
                checked={createInvitedSponsorIds.includes(sponsor.id)}
                onCheckedChange={() => {
                  toggleCreateSponsorInvite(sponsor.id)
                }}
              />
              <span className="text-sm">{sponsor.name}</span>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isCreatingAuction}>
        {isCreatingAuction ? <Spinner /> : "Create draft"}
      </Button>
    </form>
  )
}
