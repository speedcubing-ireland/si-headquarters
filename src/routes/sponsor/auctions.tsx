import {
	createFileRoute,
	Link,
	Navigate,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Loader2, LogOut, Settings, Sun, Moon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AuctionBiddingHelpOverview } from "@/components/sponsorship/auction-bidding-help";
import { AuctionCompetitionSummaryCompact } from "@/components/sponsorship/competition-summary-panel";
import { SponsorBidStatusBadge } from "@/components/sponsorship/sponsor-bid-status-badge";
import {
	SponsorPageHeader,
	SponsorPageShell,
} from "@/components/sponsorship/sponsor-page-layout";
import { useTheme } from "@/components/theme-provider";
import { builtInThemes } from "@/lib/theme-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSponsorshipEnabled } from "@/lib/feature-flags";
import { sponsorAuthClient } from "@/lib/sponsor-auth-client";
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";
import {
	formatDateTime,
	formatEuroFromCents,
	isSealedSponsorshipFramework,
	SPONSORSHIP_BIDDING_HELP_TITLE,
	sponsorshipFrameworkLabel,
	sponsorshipStateBadgeVariant,
	sponsorshipStateLabel,
} from "@/lib/sponsorship-ui";

export const Route = createFileRoute("/sponsor/auctions")({
	component: SponsorAuctionsRoute,
});

const VISIBLE_STATES = ["scheduled", "active", "closed"] as const;
type VisibleState = (typeof VISIBLE_STATES)[number];

function SponsorAuctionsRoute() {
	if (!isSponsorshipEnabled) {
		return <Navigate to="/" />;
	}
	return <SponsorAuctionsEnabled />;
}

function ThemeToggleButton() {
	const { theme, setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" className="relative">
					<Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
					<Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
					<span className="sr-only">Toggle theme</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{builtInThemes.map(({ value, label, icon: Icon }) => (
					<DropdownMenuItem key={value} onClick={() => setTheme(value)}>
						<Icon className="mr-2 size-4" />
						<span>{label}</span>
						{theme === value ? (
							<span className="ml-auto text-xs">✓</span>
						) : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function SponsorAuctionsEnabled() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const segments = pathname.split("/").filter(Boolean);
	const isAuctionDetailRoute =
		segments.length > 2 &&
		segments[0] === "sponsor" &&
		segments[1] === "auctions";
	const navigate = useNavigate();
	const { data: authSession, isPending: authPending } =
		sponsorAuthClient.useSession();
	const sessionToken = authSession?.session.token ?? null;
	const meResult = useQuery(
		api.sponsorPortal.me,
		sessionToken ? { sessionToken } : "skip",
	);
	const auctionsResult = useQuery(
		api.sponsorPortal.listAuctions,
		sessionToken ? { sessionToken } : "skip",
	);
	const meState = useRetainedQueryResult(meResult, sessionToken ?? "skip");
	const auctionsState = useRetainedQueryResult(
		auctionsResult,
		sessionToken ?? "skip",
	);
	const me = meState.data;
	const auctions = auctionsState.data ?? [];

	useEffect(() => {
		if (authPending) return;
		if (sessionToken) return;
		void navigate({ to: "/sponsor/login" });
	}, [authPending, navigate, sessionToken]);

	const auctionsByState = useMemo(() => {
		const items = auctions;
		return {
			active: items.filter((auction) => auction.state === "active"),
			scheduled: items.filter((auction) => auction.state === "scheduled"),
			closed: items.filter((auction) => auction.state === "closed"),
		};
	}, [auctions]);

	if (authPending || !sessionToken) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}
	if (isAuctionDetailRoute) {
		return <Outlet />;
	}

	const onLogout = async () => {
		await sponsorAuthClient.signOut();
		toast.success("Signed out.");
		await navigate({ to: "/sponsor/login" });
	};

	return (
		<SponsorPageShell maxWidthClassName="max-w-6xl">
			<SponsorPageHeader
				title={me?.name ? `${me.name} Auctions` : "Your Auctions"}
				actions={
					<>
						<ThemeToggleButton />
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
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="text-xs">Scheduled</CardDescription>
						<CardTitle className="text-2xl">
							{auctionsState.isLoading
								? "..."
								: auctionsByState.scheduled.length}
						</CardTitle>
					</CardHeader>
					<CardContent className="text-xs text-muted-foreground">
						Upcoming opportunities
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="text-xs">Active</CardDescription>
						<CardTitle className="text-2xl">
							{auctionsState.isLoading ? "..." : auctionsByState.active.length}
						</CardTitle>
					</CardHeader>
					<CardContent className="text-xs text-muted-foreground">
						Bidding currently open
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="text-xs">Closed</CardDescription>
						<CardTitle className="text-2xl">
							{auctionsState.isLoading ? "..." : auctionsByState.closed.length}
						</CardTitle>
					</CardHeader>
					<CardContent className="text-xs text-muted-foreground">
						Completed sponsorship outcomes
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Auctions</CardTitle>
					<CardDescription>
						View scheduled, active, and closed auctions available to your
						account.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{auctionsState.isLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : auctions.length === 0 ? (
						<div className="rounded-md border border-dashed p-8 text-sm text-muted-foreground">
							No sponsor auctions are available for your account yet.
						</div>
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
								const stateAuctions = auctionsByState[state];
								return (
									<TabsContent key={state} value={state} className="space-y-2">
										{stateAuctions.length === 0 ? (
											<p className="text-sm text-muted-foreground">
												No {sponsorshipStateLabel(state).toLowerCase()}{" "}
												auctions.
											</p>
										) : (
											stateAuctions.map((auction) => (
												<div key={auction.id} className="rounded-lg border p-3">
													<div className="flex flex-wrap items-start justify-between gap-3">
														<div className="space-y-1">
															<div className="flex items-center gap-2">
																<p className="font-medium">
																	{auction.competitionName}
																</p>
																<Badge
																	variant={sponsorshipStateBadgeVariant(
																		auction.state,
																	)}
																>
																	{sponsorshipStateLabel(auction.state)}
																</Badge>
															</div>
															<AuctionCompetitionSummaryCompact
																summary={auction.competitionSummary}
															/>
															<p className="text-sm text-muted-foreground">
																Auction Type:{" "}
																{sponsorshipFrameworkLabel(auction.framework)}
															</p>
															<p className="text-sm text-muted-foreground">
																Auction Window:{" "}
																{formatDateTime(auction.startsAt)} to{" "}
																{formatDateTime(auction.endsAt)}
															</p>
															{auction.competitionSummarySource !== "wca" ? (
																<p className="text-sm text-warning-foreground">
																	Detailed competition data is still syncing
																	from WCA.
																</p>
															) : null}
															<p className="text-sm text-muted-foreground">
																{isSealedSponsorshipFramework(
																	auction.framework,
																) && auction.state !== "closed"
																	? `Minimum bid: ${formatEuroFromCents(auction.startPriceCents)} · Price sealed until close`
																	: isSealedSponsorshipFramework(
																				auction.framework,
																			) && auction.state === "closed"
																		? `Winning bid: ${formatEuroFromCents(
																				auction.settlementAmountCents ??
																					auction.currentPriceCents ??
																					auction.startPriceCents,
																			)}`
																		: `Current: ${formatEuroFromCents(
																				auction.currentPriceCents ??
																					auction.startPriceCents,
																			)}${
																				auction.state === "closed" &&
																				auction.settlementAmountCents !==
																					undefined
																					? ` · Winning bid: ${formatEuroFromCents(auction.settlementAmountCents)}`
																					: ""
																			}`}
															</p>
															{auction.sponsorBidStatus ? (
																<div className="pt-1">
																	<SponsorBidStatusBadge
																		status={auction.sponsorBidStatus}
																		size="compact"
																	/>
																</div>
															) : null}
														</div>
														<Button asChild size="sm">
															<Link
																to="/sponsor/auctions/$auctionId"
																params={{ auctionId: auction.id }}
															>
																{auction.state === "closed"
																	? "View result"
																	: "Open auction"}
															</Link>
														</Button>
													</div>
												</div>
											))
										)}
									</TabsContent>
								);
							})}
						</Tabs>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{SPONSORSHIP_BIDDING_HELP_TITLE}</CardTitle>
					<CardDescription>
						Each auction uses one of these formats. Open any auction for
						detail-specific guidance.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<AuctionBiddingHelpOverview />
				</CardContent>
			</Card>
		</SponsorPageShell>
	);
}
