import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ArrowRight, BookOpen, LogOut, Settings } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useMemo, type ReactNode } from "react"
import { api } from "@/convex/_generated/api"
import { PageListMessage } from "@/components/layout/page-list-message"
import { StatCard } from "@/components/stat-card"
import { AuctionCompetitionSummaryCompact } from "@/plugins/sponsor/components/competition-summary-panel"
import { SponsoredCompetitionCard } from "@/plugins/sponsor/components/sponsored-competition-card"
import { SponsorMetricLabel } from "@/plugins/sponsor/components/sponsor-metric-tile"
import { SponsorBidStatusBadge } from "@/plugins/sponsor/components/sponsor-bid-status-badge"
import {
  SponsorInlineLoading,
  SponsorPageLoading,
} from "@/plugins/sponsor/components/sponsor-ui"
import {
  SponsorPageHeader,
  SponsorPageShell,
} from "@/plugins/sponsor/components/sponsor-page-layout"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSponsorPortalSignOut } from "@/plugins/sponsor/lib/use-sponsor-portal-sign-out"
import { useRequireSponsorSession } from "@/plugins/sponsor/lib/sponsor-session-token"
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result"
import { cn } from "@/lib/utils"
import {
  formatAuctionTablePrice,
  formatEuroFromCents,
  SPONSOR_GUIDE_PAGE_TITLE,
  sponsorshipFrameworkLabel,
  sponsorshipStateLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui"

type PortalAuctionListRow = FunctionReturnType<
  typeof api.plugins.sponsor.portal.auctions.listAuctions
>[number]

const VISIBLE_STATES = ["active", "scheduled", "closed"] as const
type VisibleState = (typeof VISIBLE_STATES)[number]

function auctionListActionLabel(auction: PortalAuctionListRow): string {
  if (auction.state === "closed") return "View result"
  if (auction.state === "scheduled") return "Preview auction"
  switch (auction.sponsorBidStatus) {
    case "winning":
      return "Manage bid"
    case "not_winning":
      return "Counter bid"
    case "bid_submitted":
      return "Review bid"
    case "no_bid_submitted":
    case "winner":
    case "not_winner":
    case undefined:
      return "Place bid"
  }
}

interface AuctionListMetricColumn {
  label: string
  value: ReactNode
  valueClassName?: string
  isStatus?: boolean
}

function AuctionListStatusValue({
  status,
}: {
  status: PortalAuctionListRow["sponsorBidStatus"]
}) {
  if (!status) {
    return <span className="text-sm text-muted-foreground">Not started</span>
  }
  return <SponsorBidStatusBadge status={status} size="compact" showDot />
}

function auctionListMetrics(
  auction: PortalAuctionListRow
): AuctionListMetricColumn[] {
  const { amountCents } = formatAuctionTablePrice(auction)
  const statusColumn = {
    value: <AuctionListStatusValue status={auction.sponsorBidStatus} />,
    isStatus: true as const,
  }

  if (auction.state === "closed") {
    return [
      {
        label: "Ended",
        value: formatDistanceToNow(new Date(auction.endsAt), {
          addSuffix: true,
        }),
      },
      {
        label: "Final winning bid",
        value: formatEuroFromCents(amountCents),
        valueClassName: "tabular-nums",
      },
      { label: "Your result", ...statusColumn },
    ]
  }

  if (auction.state === "scheduled") {
    return [
      {
        label: "Opens",
        value: formatDistanceToNow(new Date(auction.startsAt), {
          addSuffix: true,
        }),
      },
      {
        label: "Opening bid",
        value: formatEuroFromCents(auction.startPriceCents),
        valueClassName: "tabular-nums",
      },
      { label: "Your status", ...statusColumn },
    ]
  }

  return [
    {
      label: "Deadline",
      value: `Closes ${formatDistanceToNow(new Date(auction.endsAt), {
        addSuffix: true,
      })}`,
    },
    {
      label: "Current price",
      value: formatEuroFromCents(amountCents),
      valueClassName: "tabular-nums",
    },
    { label: "Your status", ...statusColumn },
  ]
}

function AuctionListMetricGrid({
  columns,
}: {
  columns: AuctionListMetricColumn[]
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {columns.map((column) => (
        <div key={column.label}>
          <SponsorMetricLabel>{column.label}</SponsorMetricLabel>
          <div
            className={cn(
              "mt-1",
              column.isStatus === true
                ? undefined
                : cn("text-lg font-semibold", column.valueClassName)
            )}
          >
            {column.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function AuctionListRow({ auction }: { auction: PortalAuctionListRow }) {
  const actionLabel = auctionListActionLabel(auction)
  const isActive = auction.state === "active"
  const showNeedsAttention =
    isActive && auction.sponsorBidStatus === "not_winning"

  return (
    <Card size="sm">
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0 space-y-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{auction.competitionName}</CardTitle>
                <Badge variant="secondary">
                  {sponsorshipFrameworkLabel(auction.framework)}
                </Badge>
                {showNeedsAttention ? (
                  <Badge variant="destructive">Needs attention</Badge>
                ) : null}
              </div>
              <AuctionCompetitionSummaryCompact
                summary={auction.competitionSummary}
              />
              {auction.competitionSummarySource !== "wca" ? (
                <p className="text-sm text-muted-foreground">
                  Detailed competition data is still syncing from WCA.
                </p>
              ) : null}
            </div>
            <AuctionListMetricGrid columns={auctionListMetrics(auction)} />
          </div>
          <Button asChild variant={isActive ? "default" : "outline"}>
            <Link
              to="/sponsor/auctions/$auctionId"
              params={{ auctionId: auction.id }}
            >
              {actionLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function PortalAuctionsPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const segments = pathname.split("/").filter(Boolean)
  const isAuctionDetailRoute =
    segments.length > 2 &&
    segments[0] === "sponsor" &&
    segments[1] === "auctions"
  const { sessionToken, authPending } = useRequireSponsorSession()
  const onLogout = useSponsorPortalSignOut()
  const meResult = useQuery(
    api.plugins.sponsor.portal.auth.me,
    sessionToken !== null ? { sessionToken } : "skip"
  )
  const auctionsResult = useQuery(
    api.plugins.sponsor.portal.auctions.listAuctions,
    sessionToken !== null ? { sessionToken } : "skip"
  )
  const sponsorshipsResult = useQuery(
    api.plugins.sponsor.portal.sponsorships.listMySponsorships,
    sessionToken !== null ? { sessionToken } : "skip"
  )
  const meState = useRetainedQueryResult(meResult, sessionToken ?? "skip")
  const auctionsState = useRetainedQueryResult(
    auctionsResult,
    sessionToken ?? "skip"
  )
  const sponsorshipsState = useRetainedQueryResult(
    sponsorshipsResult,
    sessionToken ?? "skip"
  )
  const me = meState.data
  const auctions = useMemo(() => auctionsState.data ?? [], [auctionsState.data])
  const sponsorships = useMemo(
    () => sponsorshipsState.data ?? [],
    [sponsorshipsState.data]
  )

  const auctionsByState = useMemo(() => {
    const items = auctions
    return {
      active: [...items.filter((auction) => auction.state === "active")].sort(
        (a, b) => a.endsAt - b.endsAt
      ),
      scheduled: [
        ...items.filter((auction) => auction.state === "scheduled"),
      ].sort((a, b) => a.startsAt - b.startsAt),
      closed: [...items.filter((auction) => auction.state === "closed")].sort(
        (a, b) => b.endsAt - a.endsAt
      ),
    }
  }, [auctions])

  if (authPending || sessionToken === null) {
    return <SponsorPageLoading />
  }
  if (isAuctionDetailRoute) {
    return <Outlet />
  }

  return (
    <SponsorPageShell maxWidthClassName="max-w-6xl">
      <SponsorPageHeader
        title={
          me?.sponsor.name !== undefined && me.sponsor.name.length > 0
            ? `${me.sponsor.name} Sponsorship`
            : "Your sponsorship"
        }
        actions={
          <>
            <ThemeToggle />
            <Button asChild variant="outline">
              <Link to="/sponsor/guide">
                <BookOpen className="size-4" />
                Guide
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon">
              <Link to="/sponsor/settings">
                <Settings className="size-4" />
                <span className="sr-only">Settings</span>
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void onLogout()}>
              <LogOut className="size-4" />
              Log out
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Active"
          value={auctionsState.isLoading ? "…" : auctionsByState.active.length}
          description="Bidding currently open"
          emphasis
        />
        <StatCard
          label="Scheduled"
          value={
            auctionsState.isLoading ? "…" : auctionsByState.scheduled.length
          }
          description="Upcoming opportunities"
        />
        <StatCard
          label="Closed"
          value={auctionsState.isLoading ? "…" : auctionsByState.closed.length}
          description="Completed sponsorship outcomes"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auction board</CardTitle>
          <CardDescription>
            Acquire sponsorship rights through scheduled, active, and closed
            auctions. Closed auctions stay here as your bidding record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auctionsState.isLoading ? (
            <SponsorInlineLoading />
          ) : auctions.length === 0 ? (
            <PageListMessage>
              No sponsor auctions are available for your account yet.
            </PageListMessage>
          ) : (
            <Tabs defaultValue="active" className="space-y-3">
              <TabsList className="grid grid-cols-3">
                {VISIBLE_STATES.map((state) => (
                  <TabsTrigger key={state} value={state}>
                    {sponsorshipStateLabel(state)} (
                    {auctionsByState[state].length})
                  </TabsTrigger>
                ))}
              </TabsList>
              {VISIBLE_STATES.map((state: VisibleState) => {
                const stateAuctions = auctionsByState[state]
                return (
                  <TabsContent key={state} value={state} className="space-y-2">
                    {stateAuctions.length === 0 ? (
                      <PageListMessage>
                        No {sponsorshipStateLabel(state).toLowerCase()}{" "}
                        auctions.
                      </PageListMessage>
                    ) : (
                      stateAuctions.map((auction) => (
                        <AuctionListRow key={auction.id} auction={auction} />
                      ))
                    )}
                  </TabsContent>
                )
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            My sponsored competitions
            {sponsorshipsState.isLoading
              ? null
              : sponsorships.length > 0
                ? ` (${String(sponsorships.length)})`
                : null}
          </h2>
          <p className="text-sm text-muted-foreground">
            Competitions you won. View your upcoming event details here.
          </p>
        </div>
        {sponsorshipsState.isLoading ? (
          <SponsorInlineLoading />
        ) : sponsorships.length === 0 ? (
          <PageListMessage>
            When you win an auction or are assigned as sponsor, your
            competitions will appear here as assets to manage.
          </PageListMessage>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sponsorships.map((sponsorship) => (
              <SponsoredCompetitionCard
                key={sponsorship.competitionId}
                competitionName={sponsorship.competitionName}
                competitionSummary={sponsorship.competitionSummary}
                lifecycle={sponsorship.lifecycle}
                managementAuctionId={sponsorship.managementAuctionId}
              />
            ))}
          </div>
        )}
      </section>

      <Card className="border-dashed bg-muted/50">
        <CardHeader>
          <CardTitle>{SPONSOR_GUIDE_PAGE_TITLE}</CardTitle>
          <CardDescription>
            Learn how sealed bid, Vickrey, and proxy bidding work, including
            closing rules and sponsorship policy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/sponsor/guide">
              <BookOpen className="size-4" />
              Read sponsor information
            </Link>
          </Button>
        </CardContent>
      </Card>
    </SponsorPageShell>
  )
}
