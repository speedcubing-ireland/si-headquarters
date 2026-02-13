import {
	createFileRoute,
	Link,
	Navigate,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Loader2, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useTheme } from "@/components/theme-provider";
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
import {
	formatDateTime,
	formatEuroFromCents,
	sponsorshipFrameworkLabel,
	sponsorshipStateBadgeVariant,
	sponsorshipStateLabel,
} from "@/lib/sponsorship-ui";

export const Route = createFileRoute("/sponsor/auctions")({
	component: SponsorAuctionsRoute,
});

const VISIBLE_STATES = ["active", "scheduled", "closed"] as const;
type VisibleState = (typeof VISIBLE_STATES)[number];
type Theme = "light" | "dark" | "system";

const THEMES: Array<{
	value: Theme;
	label: string;
	icon: LucideIcon;
}> = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
];

function sponsorBidStatusLabel(
	status:
		| "winning"
		| "not_winning"
		| "winner"
		| "not_winner"
		| "bid_submitted"
		| "no_bid_submitted",
) {
	switch (status) {
		case "winning":
			return "Winning";
		case "not_winning":
			return "Not winning";
		case "winner":
			return "Winner";
		case "not_winner":
			return "Not winner";
		case "bid_submitted":
			return "Bid submitted";
		case "no_bid_submitted":
			return "No bid submitted";
	}
}

function sponsorBidStatusClassName(
	status:
		| "winning"
		| "not_winning"
		| "winner"
		| "not_winner"
		| "bid_submitted"
		| "no_bid_submitted",
) {
	if (status === "bid_submitted") {
		return "inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400";
	}
	return status === "winning" || status === "winner"
		? "inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400"
		: "inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-400";
}

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
				{THEMES.map(({ value, label, icon: Icon }) => (
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
	const me = useQuery(
		api.sponsorPortal.me,
		sessionToken ? { sessionToken } : "skip",
	);
	const auctions = useQuery(
		api.sponsorPortal.listAuctions,
		sessionToken ? { sessionToken } : "skip",
	);

	useEffect(() => {
		if (authPending) return;
		if (sessionToken) return;
		void navigate({ to: "/sponsor/login" });
	}, [authPending, navigate, sessionToken]);

	const auctionsByState = useMemo(() => {
		const items = auctions ?? [];
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
		<div className="min-h-svh bg-gradient-to-b from-muted/40 to-background px-4 py-6">
			<div className="mx-auto w-full max-w-6xl space-y-4">
				<header className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-xs uppercase tracking-wide text-muted-foreground">
							Sponsor Portal
						</p>
						<h1 className="text-2xl font-semibold">
							{me?.name ? `${me.name} Auctions` : "Your Auctions"}
						</h1>
					</div>
					<div className="flex items-center gap-2">
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
					</div>
				</header>

				<div className="grid gap-3 sm:grid-cols-3">
					<Card>
						<CardHeader className="pb-2">
							<CardDescription className="text-xs">Active</CardDescription>
							<CardTitle className="text-2xl">
								{auctionsByState.active.length}
							</CardTitle>
						</CardHeader>
						<CardContent className="text-xs text-muted-foreground">
							Bidding currently open
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardDescription className="text-xs">Scheduled</CardDescription>
							<CardTitle className="text-2xl">
								{auctionsByState.scheduled.length}
							</CardTitle>
						</CardHeader>
						<CardContent className="text-xs text-muted-foreground">
							Upcoming opportunities
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardDescription className="text-xs">Closed</CardDescription>
							<CardTitle className="text-2xl">
								{auctionsByState.closed.length}
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
							View active, scheduled, and closed auctions available to your
							account.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{auctions === undefined ? (
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
										<TabsContent
											key={state}
											value={state}
											className="space-y-2"
										>
											{stateAuctions.length === 0 ? (
												<p className="text-sm text-muted-foreground">
													No {sponsorshipStateLabel(state).toLowerCase()}{" "}
													auctions.
												</p>
											) : (
												stateAuctions.map((auction) => (
													<div
														key={auction.id}
														className="rounded-lg border p-3"
													>
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
																<p className="text-sm text-muted-foreground">
																	{sponsorshipFrameworkLabel(auction.framework)}
																</p>
																<p className="text-xs text-muted-foreground">
																	Window: {formatDateTime(auction.startsAt)} -{" "}
																	{formatDateTime(auction.endsAt)}
																</p>
																<p className="text-xs text-muted-foreground">
																	{auction.framework === "first_sealed" &&
																	auction.state !== "closed"
																		? `Minimum bid: ${formatEuroFromCents(auction.startPriceCents)} · Price sealed until close`
																		: `Current: ${formatEuroFromCents(
																				auction.currentPriceCents ??
																					auction.startPriceCents,
																			)}${
																				auction.state === "closed" &&
																				auction.settlementAmountCents !==
																					undefined
																					? ` · Settlement: ${formatEuroFromCents(auction.settlementAmountCents)}`
																					: ""
																			}`}
																</p>
																{auction.sponsorBidStatus ? (
																	<div className="pt-1">
																		<span
																			className={sponsorBidStatusClassName(
																				auction.sponsorBidStatus,
																			)}
																		>
																			{sponsorBidStatusLabel(
																				auction.sponsorBidStatus,
																			)}
																		</span>
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
			</div>
		</div>
	);
}
