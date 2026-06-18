import { Navigate, useNavigate } from "@tanstack/react-router"
import type { Id } from "@/convex/_generated/dataModel"
import { ConvexError } from "convex/values"
import { messageFromErrorPayload } from "@/convex/integrations/errorPayload"
import { useAction, useMutation, useQuery } from "convex/react"
import { ArrowLeft, ArrowUpRight, Info, ShieldCheck } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { SubmitEvent } from "react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { AuctionBiddingHelpDialog } from "@/plugins/sponsor/components/auction-bidding-help"
import {
  AuctionBidActivityCard,
  AuctionBiddingActionCard,
  AuctionBiddingSummaryCard,
  AuctionProxyBiddingPanels,
  AuctionProxyHeroStatusCard,
  AuctionUnavailableCard,
} from "@/plugins/sponsor/components/auction-bidding-cards"
import { AuctionCompetitionSummaryPanel } from "@/plugins/sponsor/components/competition-summary-panel"
import {
  SponsorPageHeader,
  SponsorPageShell,
} from "@/plugins/sponsor/components/sponsor-page-layout"
import { SponsorPageLoading } from "@/plugins/sponsor/components/sponsor-ui"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format/irish-dates"
import {
  auctionFrameworkLabel,
  isProxyAuctionFramework,
  isSealedAuctionFramework,
} from "@/convex/plugins/sponsor/lib/types"
import {
  formatEuroFromCents,
  proxyDirectBidCopy,
  proxyMaxBidCopy,
  SPONSORSHIP_BIDDING_HELP_TITLE,
  sponsorshipStateBadgeVariant,
  sponsorshipStateLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui"
import { useRequireSponsorSession } from "@/plugins/sponsor/lib/sponsor-session-token"
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result"

function toSponsorBidErrorMessage(
  // oxlint-disable-next-line typescript/no-restricted-types -- catch bindings are unknown
  caught: unknown
): string {
  if (caught instanceof ConvexError) {
    return messageFromErrorPayload(caught.data) ?? "Failed to submit bid."
  }
  return "Failed to submit bid."
}

function formatAuctionCountdown(targetTime: number, now: number): string {
  const totalSeconds = Math.max(0, Math.ceil((targetTime - now) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":")
}

export function PortalAuctionDetailPage({
  auctionId: typedAuctionId,
}: {
  auctionId: Id<"sponsorshipAuctions">
}) {
  const navigate = useNavigate()
  const { sessionToken, authPending } = useRequireSponsorSession()
  const [amountEuros, setAmountEuros] = useState("")
  const [isBiddingHelpOpen, setIsBiddingHelpOpen] = useState(false)
  const [isSubmittingBid, setIsSubmittingBid] = useState(false)
  const [isSubmittingMaxBid, setIsSubmittingMaxBid] = useState(false)
  const [pendingBidCents, setPendingBidCents] = useState<number | null>(null)
  const [pendingMaxBidCents, setPendingMaxBidCents] = useState<number | null>(
    null
  )
  const [now, setNow] = useState(() => Date.now())
  const refreshedSummaryAuctionIdRef = useRef<string | null>(null)
  const [maxAmountEurosOverride, setMaxAmountEurosOverride] = useState<
    string | null
  >(null)
  const [maxAmountEurosAuctionId, setMaxAmountEurosAuctionId] = useState<
    string | null
  >(null)
  const placeBid = useMutation(api.plugins.sponsor.portal.auctions.placeBid)
  const setMaxBid = useMutation(api.plugins.sponsor.portal.auctions.setMaxBid)
  const refreshCompetitionSnapshot = useAction(
    api.plugins.sponsor.admin.auctions.competitionSnapshot
      .refreshCompetitionSnapshot
  )

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const dataResult = useQuery(
    api.plugins.sponsor.portal.auctions.getAuction,
    sessionToken !== null
      ? {
          sessionToken,
          auctionId: typedAuctionId,
        }
      : "skip"
  )
  const dataState = useRetainedQueryResult(
    dataResult,
    sessionToken !== null ? `${sessionToken}:${typedAuctionId}` : "skip"
  )
  const queryData = dataState.data
  const maxAmountEurosFromQuery =
    queryData !== undefined &&
    queryData !== null &&
    isProxyAuctionFramework(queryData.auction.framework)
      ? queryData.myMaxBidCents !== undefined
        ? (queryData.myMaxBidCents / 100).toFixed(2)
        : ""
      : ""
  const currentAuctionId =
    queryData !== undefined && queryData !== null
      ? String(queryData.auction.id)
      : null
  const maxAmountEuros =
    maxAmountEurosOverride !== null &&
    maxAmountEurosAuctionId === currentAuctionId
      ? maxAmountEurosOverride
      : maxAmountEurosFromQuery
  const setMaxAmountEurosSynced = (value: string) => {
    setMaxAmountEurosOverride(value)
    setMaxAmountEurosAuctionId(currentAuctionId)
  }

  useEffect(() => {
    if (
      queryData === undefined ||
      queryData === null ||
      sessionToken === null
    ) {
      return
    }
    if (queryData.auction.competitionSummarySource === "wca") {
      return
    }
    const auctionIdToRefresh = String(queryData.auction.id)
    if (refreshedSummaryAuctionIdRef.current === auctionIdToRefresh) return
    refreshedSummaryAuctionIdRef.current = auctionIdToRefresh
    void refreshCompetitionSnapshot({
      auctionId: queryData.auction.id,
      sessionToken,
    })
  }, [queryData, refreshCompetitionSnapshot, sessionToken])

  if (authPending) {
    return <SponsorPageLoading />
  }
  if (sessionToken === null) return null
  if (dataState.isLoading) {
    return <SponsorPageLoading />
  }
  const data = dataState.data
  if (data === null) {
    return <Navigate to="/sponsor/auctions" />
  }

  const isProxyAuction = isProxyAuctionFramework(data.auction.framework)
  const minimumNextBidCents = data.auction.minimumNextBidCents
  const minimumNextBidEuros = (minimumNextBidCents / 100).toFixed(2)
  const minimumBidCents = isProxyAuction
    ? minimumNextBidCents
    : data.auction.startPriceCents
  const minimumBidEuros = (minimumBidCents / 100).toFixed(2)

  const requestSubmitBid = (event: SubmitEvent) => {
    event.preventDefault()
    const amount = amountEuros.length
      ? Math.round(Number(amountEuros) * 100)
      : undefined
    if (amount === undefined) {
      toast.error("Enter a bid amount.")
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid bid amount.")
      return
    }
    if (amount < minimumBidCents) {
      toast.error(
        `Bid must be at least ${formatEuroFromCents(minimumBidCents)}.`
      )
      return
    }
    setPendingBidCents(amount)
  }

  const submitBid = async () => {
    if (pendingBidCents === null) return
    setIsSubmittingBid(true)
    try {
      await placeBid({
        sessionToken,
        auctionId: typedAuctionId,
        amountCents: pendingBidCents,
      })
      toast.success(isProxyAuction ? "Bid submitted." : "Sealed bid submitted.")
      setAmountEuros("")
      setPendingBidCents(null)
    } catch (caught) {
      toast.error(toSponsorBidErrorMessage(caught))
    } finally {
      setIsSubmittingBid(false)
    }
  }

  const requestSubmitMaxBid = (event: SubmitEvent) => {
    event.preventDefault()
    if (!isProxyAuction) {
      toast.error("Max bids are only available for Proxy Bidding auctions.")
      return
    }
    const max = maxAmountEuros.length
      ? Math.round(Number(maxAmountEuros) * 100)
      : undefined
    if (max === undefined || !Number.isFinite(max) || max <= 0) {
      toast.error("Enter a valid max amount.")
      return
    }
    if (max < minimumNextBidCents) {
      toast.error(
        `Max bid must be at least ${formatEuroFromCents(minimumNextBidCents)}.`
      )
      return
    }
    setPendingMaxBidCents(max)
  }

  const submitMaxBid = async () => {
    if (pendingMaxBidCents === null) return
    setIsSubmittingMaxBid(true)
    try {
      await setMaxBid({
        sessionToken,
        auctionId: typedAuctionId,
        maxAmountCents: pendingMaxBidCents,
      })
      toast.success("Max bid updated.")
      setMaxAmountEurosSynced((pendingMaxBidCents / 100).toFixed(2))
      setPendingMaxBidCents(null)
    } catch (caught) {
      toast.error(toSponsorBidErrorMessage(caught))
    } finally {
      setIsSubmittingMaxBid(false)
    }
  }

  const auctionEnded = data.auction.state === "closed"
  const closingStatusText = auctionEnded
    ? `Closed ${formatDateTime(data.auction.endsAt)}`
    : data.auction.state === "scheduled"
      ? `Opens in ${formatAuctionCountdown(data.auction.startsAt, now)}`
      : `Closes in ${formatAuctionCountdown(data.auction.endsAt, now)}`
  const isSealedPriceHidden =
    isSealedAuctionFramework(data.auction.framework) &&
    data.auction.state !== "closed"
  const isClosedSealedAuction =
    isSealedAuctionFramework(data.auction.framework) &&
    data.auction.state === "closed"
  const currentPriceCentsForDisplay =
    data.auction.state === "closed"
      ? (data.auction.settlementAmountCents ??
        data.auction.currentPriceCents ??
        data.auction.startPriceCents)
      : (data.auction.currentPriceCents ?? data.auction.startPriceCents)
  const bidActivityItems = data.events
    .slice()
    .reverse()
    .map((event) => ({
      id: event.id,
      sponsorLabel: event.sponsorLabel,
      amountLabel: formatEuroFromCents(event.amountCents),
      isOwnBid: event.isOwnBid,
      typeLabel: event.isOwnBid ? (event.isAuto ? "Auto" : "Manual") : "Bid",
      createdAtLabel: formatDateTime(event.createdAt),
    }))
  const isWinningProxyBidder =
    isProxyAuction && data.auction.sponsorBidStatus === "winning"
  const directBidCopy = proxyDirectBidCopy(data.auction.sponsorBidStatus)
  const maxBidCopy = proxyMaxBidCopy(data.myMaxBidCents)
  const proxyStatusNotice = isWinningProxyBidder
    ? "You are currently winning! The proxy system will automatically bid on your behalf up to your secret maximum."
    : data.auction.sponsorBidStatus === "not_winning"
      ? "You are not winning. Place a counter bid to regain the lead, or raise your secret max so proxy bidding can respond for you."
      : "You have not bid yet. Place a visible bid, set a secret max, or do both before the auction closes."
  const isClosingSoon =
    data.auction.state === "active" &&
    data.auction.endsAt - now < 10 * 60 * 1000
  const canBid = data.canBid
  const myMaxBidSummaryText =
    data.myMaxBidCents !== undefined
      ? formatEuroFromCents(data.myMaxBidCents)
      : "No max bid set"
  return (
    <SponsorPageShell maxWidthClassName="max-w-5xl">
      <SponsorPageHeader
        title={data.auction.competitionName}
        subtitle={auctionFrameworkLabel(data.auction.framework)}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsBiddingHelpOpen(true)
              }}
            >
              <Info className="size-4" />
              {SPONSORSHIP_BIDDING_HELP_TITLE}
            </Button>
            <Button
              variant="outline"
              onClick={() => void navigate({ to: "/sponsor/auctions" })}
            >
              <ArrowLeft className="size-4" />
              Back to auctions
            </Button>
          </>
        }
      />

      {isProxyAuction ? (
        <AuctionProxyHeroStatusCard
          currentPriceLabel={
            data.auction.state === "closed" ? "Final price" : "Current price"
          }
          currentPriceText={formatEuroFromCents(currentPriceCentsForDisplay)}
          closesAtText={closingStatusText}
          isClosingSoon={isClosingSoon}
          sponsorBidStatus={data.auction.sponsorBidStatus}
          myMaxBidText={myMaxBidSummaryText}
        />
      ) : (
        <AuctionBiddingSummaryCard
          stateLabel={sponsorshipStateLabel(data.auction.state)}
          stateVariant={sponsorshipStateBadgeVariant(data.auction.state)}
          helpTitle={SPONSORSHIP_BIDDING_HELP_TITLE}
          closesAtText={closingStatusText}
          priceLabel={
            isSealedPriceHidden
              ? "Current price hidden"
              : isClosedSealedAuction
                ? "Winning bid"
                : "Current price"
          }
          priceValue={
            isSealedPriceHidden
              ? "Sealed until close"
              : formatEuroFromCents(currentPriceCentsForDisplay)
          }
          sponsorBidStatus={data.auction.sponsorBidStatus}
          personalMetricLabel="Your latest bid"
          personalMetricText={
            data.myLastBidCents !== undefined
              ? formatEuroFromCents(data.myLastBidCents)
              : "No bid yet"
          }
        />
      )}

      <AuctionBiddingHelpDialog
        framework={data.auction.framework}
        open={isBiddingHelpOpen}
        onOpenChange={setIsBiddingHelpOpen}
      />

      {data.auction.state === "active" && canBid ? (
        isProxyAuction ? (
          <AuctionProxyBiddingPanels
            minimumNextBidText={formatEuroFromCents(minimumNextBidCents)}
            amountEuros={amountEuros}
            maxAmountEuros={maxAmountEuros}
            minimumNextBidEuros={minimumNextBidEuros}
            directBidTitle={directBidCopy.title}
            directBidDescription={directBidCopy.description}
            directBidSubmitLabel={directBidCopy.submitLabel}
            maxBidTitle={maxBidCopy.title}
            maxBidDescription={maxBidCopy.description}
            maxBidSubmitLabel={maxBidCopy.submitLabel}
            statusNotice={proxyStatusNotice}
            sponsorBidStatus={data.auction.sponsorBidStatus}
            isSubmittingNormalBid={isSubmittingBid}
            isSubmittingMaxBid={isSubmittingMaxBid}
            normalBidConfirmation={
              pendingBidCents !== null
                ? {
                    open: true,
                    title: directBidCopy.confirmationTitle,
                    description: directBidCopy.confirmationDescription,
                    amountLabel: "Visible bid",
                    amountValue: formatEuroFromCents(pendingBidCents),
                    detailLabel: "Current effect",
                    detailValue: isWinningProxyBidder
                      ? "Raises visible price"
                      : "May trigger proxy response",
                    confirmLabel: directBidCopy.submitLabel,
                    isSubmitting: isSubmittingBid,
                    icon: <ArrowUpRight className="size-5" aria-hidden />,
                    onOpenChange: (open) => {
                      if (!open) setPendingBidCents(null)
                    },
                    onConfirm: () => {
                      void submitBid()
                    },
                  }
                : undefined
            }
            maxBidConfirmation={
              pendingMaxBidCents !== null
                ? {
                    open: true,
                    title: maxBidCopy.confirmationTitle,
                    description: maxBidCopy.confirmationDescription,
                    amountLabel: "Secret max",
                    amountValue: formatEuroFromCents(pendingMaxBidCents),
                    detailLabel: "Current effect",
                    detailValue: "Stays hidden",
                    confirmLabel: maxBidCopy.submitLabel,
                    isSubmitting: isSubmittingMaxBid,
                    icon: <ShieldCheck className="size-5" aria-hidden />,
                    onOpenChange: (open) => {
                      if (!open) setPendingMaxBidCents(null)
                    },
                    onConfirm: () => {
                      void submitMaxBid()
                    },
                  }
                : undefined
            }
            onAmountChange={setAmountEuros}
            onMaxAmountChange={setMaxAmountEurosSynced}
            onSubmitNormalBid={(event: SubmitEvent) => {
              requestSubmitBid(event)
            }}
            onSubmitMaxBid={(event: SubmitEvent) => {
              requestSubmitMaxBid(event)
            }}
          />
        ) : (
          <AuctionBiddingActionCard
            bidForm={{
              title: "Submit sealed bid",
              description:
                "Enter the amount you are willing to pay. You can update it before the auction closes.",
              minimumLabel: "Minimum sealed bid",
              minimumValue: formatEuroFromCents(minimumBidCents),
              minimumHint: "Only your latest submitted sealed bid counts.",
              inputId: "amount",
              inputLabel: "Bid amount (EUR)",
              inputValue: amountEuros,
              inputMin: minimumBidEuros,
              inputPlaceholder: minimumBidEuros,
              onInputChange: setAmountEuros,
              onSubmit: (event: SubmitEvent) => {
                requestSubmitBid(event)
              },
              submitLabel: "Submit sealed bid",
              isSubmitting: isSubmittingBid,
            }}
            sealedNotice={
              data.myLastBidCents !== undefined
                ? `Your submitted bid is ${formatEuroFromCents(data.myLastBidCents)}. Submitting again replaces it.`
                : "You have not submitted a sealed bid yet."
            }
            confirmation={
              pendingBidCents !== null
                ? {
                    open: true,
                    title: "Submit this sealed bid?",
                    description:
                      "Only your latest sealed bid counts. The amount stays hidden until the auction closes.",
                    amountLabel: "Sealed bid",
                    amountValue: formatEuroFromCents(pendingBidCents),
                    detailLabel: "Visibility",
                    detailValue: "Hidden until close",
                    confirmLabel: "Submit sealed bid",
                    isSubmitting: isSubmittingBid,
                    icon: <ShieldCheck className="size-5" aria-hidden />,
                    onOpenChange: (open) => {
                      if (!open) setPendingBidCents(null)
                    },
                    onConfirm: () => {
                      void submitBid()
                    },
                  }
                : undefined
            }
          />
        )
      ) : data.auction.state === "active" ? (
        <Alert>
          <AlertTitle>View-only access</AlertTitle>
          <AlertDescription>
            You can review this auction, but your contact does not have
            permission to place bids. Ask your sponsor administrator to enable
            bidding for your account.
          </AlertDescription>
        </Alert>
      ) : (
        <AuctionUnavailableCard
          message={
            data.auction.state === "scheduled"
              ? `Bidding is not open yet. ${closingStatusText}.`
              : "Bidding is closed for this auction."
          }
        />
      )}

      <AuctionCompetitionSummaryPanel
        summary={data.auction.competitionSummary}
        source={data.auction.competitionSummarySource}
      />

      <AuctionBidActivityCard
        isProxyAuction={isProxyAuction}
        description={
          isProxyAuction
            ? "Your bids are marked as You. Other sponsors are anonymized."
            : "Sealed bid activity is hidden until auction close."
        }
        bidHistoryVisible={data.bidHistoryVisible}
        items={bidActivityItems}
        sealedMessage={
          data.myLastBidCents !== undefined
            ? `Your current sealed bid is ${formatEuroFromCents(data.myLastBidCents)}.`
            : "No sealed bid has been submitted yet."
        }
        unavailableMessage="Bid history is unavailable until bidding opens."
        emptyMessage="No bids yet."
      />
    </SponsorPageShell>
  )
}
