import { ArrowLeft } from "lucide-react"
import { useEffect, useMemo, useState, type SubmitEvent } from "react"
import { toast } from "sonner"
import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AbilityRouteGuard } from "@/features/auth"
import type { Id } from "@/convex/_generated/dataModel"
import {
  buildAuctionSubjectInput,
  emptyAuctionSubjectDraft,
  type AuctionSubjectDraft,
} from "@/plugins/sponsor/admin/auction-subject-draft"
import { AuctionCreateForm } from "@/plugins/sponsor/admin/components/auction-create-form"
import { AuctionPanelHistory } from "@/plugins/sponsor/admin/components/auction-panel-history"
import { validateAuctionFormInputs } from "@/plugins/sponsor/admin/auction-editor-draft"
import {
  filterPreviousClosedAuctionsForSubject,
  groupUnsponsoredCompetitionsByPhase,
} from "@/plugins/sponsor/admin/sponsorship-admin-derivations"
import { useAuctionCreateDraft } from "@/plugins/sponsor/admin/hooks/use-auction-create-draft"
import { useAuctionLifecycleActions } from "@/plugins/sponsor/admin/hooks/use-auction-lifecycle-actions"
import { useCompetitionOverrideRevert } from "@/plugins/sponsor/admin/hooks/use-competition-override-revert"
import { useSponsorshipEditorNavigation } from "@/plugins/sponsor/admin/use-sponsorship-admin-search"
import {
  useAuctionSettings,
  useSponsors,
  useSponsorshipAuctionMutations,
  useSponsorshipAuctionsForManager,
  useSponsorshipCompetitionsForManager,
} from "@/plugins/sponsor/hooks/use-sponsorship"

export function AuctionCreateRoute() {
  return (
    <AbilityRouteGuard
      action="access"
      subject="SponsorPortalAdmin"
      deniedMessage="Directors or Finance Team access is required."
      loadingMessage="Loading sponsorship admin…"
    >
      <AuctionCreateContent />
    </AbilityRouteGuard>
  )
}

function AuctionCreateContent() {
  const { openEditAuction, backToList, viewClosedAuction } =
    useSponsorshipEditorNavigation()
  const { competitions } = useSponsorshipCompetitionsForManager()
  const { auctions } = useSponsorshipAuctionsForManager()
  const { sponsors } = useSponsors()
  const { settings: auctionDefaults } = useAuctionSettings()
  const { createAuction } = useSponsorshipAuctionMutations()
  const { onRefreshAuctionCompetitionData } = useAuctionLifecycleActions()
  const { busyCompetitionId, onRevertCompetitionSponsorOverride } =
    useCompetitionOverrideRevert()

  const [subjectDraft, setSubjectDraft] = useState<AuctionSubjectDraft>(
    () => emptyAuctionSubjectDraft
  )
  const [isCreatingAuction, setIsCreatingAuction] = useState(false)

  const activeSponsors = useMemo(
    () => sponsors.filter((sponsor) => sponsor.active),
    [sponsors]
  )
  const { draft, onDraftChange } = useAuctionCreateDraft(
    activeSponsors,
    auctionDefaults
  )
  const sponsorById = useMemo(
    () => new Map(sponsors.map((sponsor) => [sponsor.id, sponsor])),
    [sponsors]
  )
  const competitionById = useMemo(
    () =>
      new Map(competitions.map((competition) => [competition.id, competition])),
    [competitions]
  )
  const competitionIdByString = useMemo(
    () =>
      new Map<string, Id<"competitions">>(
        competitions.map((competition) => [
          String(competition.id),
          competition.id,
        ])
      ),
    [competitions]
  )
  const unsponsoredCompetitionsByPhase = useMemo(
    () => groupUnsponsoredCompetitionsByPhase(competitions),
    [competitions]
  )
  const sponsoredCompetitions = useMemo(
    () =>
      competitions
        .filter(
          (competition) => competition.sponsorPropertyStatus === "sponsor"
        )
        .sort((a, b) => a.compStart.localeCompare(b.compStart)),
    [competitions]
  )
  const defaultCreateCompetitionId = useMemo((): Id<"competitions"> | null => {
    if (competitions.length === 0) return null
    return (unsponsoredCompetitionsByPhase[0]?.items[0] ?? competitions[0]).id
  }, [competitions, unsponsoredCompetitionsByPhase])

  useEffect(() => {
    if (
      subjectDraft.source === "hq_competition" &&
      subjectDraft.hqCompetitionId === null &&
      defaultCreateCompetitionId !== null
    ) {
      setSubjectDraft((current) =>
        current.source === "hq_competition" && current.hqCompetitionId === null
          ? { ...current, hqCompetitionId: defaultCreateCompetitionId }
          : current
      )
    }
  }, [
    defaultCreateCompetitionId,
    subjectDraft.hqCompetitionId,
    subjectDraft.source,
  ])

  const createCompetitionId =
    subjectDraft.source === "hq_competition"
      ? subjectDraft.hqCompetitionId
      : subjectDraft.source === "custom"
        ? subjectDraft.customCompetitionId
        : null
  const selectedCompetition =
    createCompetitionId === null
      ? null
      : (competitionById.get(createCompetitionId) ?? null)
  const selectedWcaCompetitionId =
    subjectDraft.source === "wca_competition"
      ? subjectDraft.wca?.id
      : selectedCompetition?.wcaCompetitionId

  const previousClosedAuctionsForPanel = useMemo(() => {
    return filterPreviousClosedAuctionsForSubject(auctions, {
      competitionId: createCompetitionId,
      wcaCompetitionId: selectedWcaCompetitionId,
    })
  }, [auctions, createCompetitionId, selectedWcaCompetitionId])

  const onCreateAuction = async (event: SubmitEvent) => {
    event.preventDefault()
    const subject = buildAuctionSubjectInput(subjectDraft)
    if (!subject.ok) {
      toast.error(subject.error)
      return
    }
    const validation = validateAuctionFormInputs(draft)
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }

    setIsCreatingAuction(true)
    try {
      const auctionId = await createAuction({
        subject: subject.value,
        framework: draft.framework,
        ...validation.values,
      })
      toast.success("Auction draft created.")
      void onRefreshAuctionCompetitionData(auctionId, false)
      openEditAuction(auctionId)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create auction."
      toast.error(message)
    } finally {
      setIsCreatingAuction(false)
    }
  }

  return (
    <Page.Shell
      title="Create Sponsorship Auction"
      contentClassName={PAGE_CONTENT_PADDING_SCROLL}
    >
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            backToList()
          }}
        >
          <ArrowLeft className="size-4" />
          Back to auctions
        </Button>

        <AuctionCreateForm
          isCreatingAuction={isCreatingAuction}
          draft={draft}
          onDraftChange={onDraftChange}
          subjectDraft={subjectDraft}
          onSubjectDraftChange={(patch) => {
            setSubjectDraft((current) => ({ ...current, ...patch }))
          }}
          activeSponsors={activeSponsors}
          selectedCompetition={selectedCompetition}
          competitions={competitions}
          unsponsoredCompetitionsByPhase={unsponsoredCompetitionsByPhase}
          sponsoredCompetitions={sponsoredCompetitions}
          competitionIdByString={competitionIdByString}
          busyCompetitionId={busyCompetitionId}
          onCreateAuction={onCreateAuction}
          onRevertCompetitionSponsorOverride={
            onRevertCompetitionSponsorOverride
          }
          sponsorById={sponsorById}
        />

        <Card>
          <CardHeader>
            <CardTitle>Previous closed auctions</CardTitle>
            <CardDescription>
              Other closed auctions for the selected competition.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuctionPanelHistory
              hasHistorySubject={
                createCompetitionId !== null ||
                selectedWcaCompetitionId !== undefined
              }
              previousClosedAuctions={previousClosedAuctionsForPanel}
              sponsorById={sponsorById}
              onViewClosedAuction={viewClosedAuction}
            />
          </CardContent>
        </Card>
      </div>
    </Page.Shell>
  )
}
