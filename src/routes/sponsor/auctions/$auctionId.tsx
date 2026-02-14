import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AuctionBiddingHelpAlert } from "@/components/sponsorship/auction-bidding-help";
import { AuctionCompetitionSummaryPanel } from "@/components/sponsorship/competition-summary-panel";
import { SponsorBidStatusBadge } from "@/components/sponsorship/sponsor-bid-status-badge";
import {
	SponsorPageHeader,
	SponsorPageShell,
} from "@/components/sponsorship/sponsor-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSponsorshipEnabled } from "@/lib/feature-flags";
import {
	formatDateTime,
	formatEuroFromCents,
	isProxySponsorshipFramework,
	isSealedSponsorshipFramework,
	SPONSORSHIP_BIDDING_HELP_TITLE,
	sponsorshipFrameworkLabel,
	sponsorshipStateBadgeVariant,
	sponsorshipStateLabel,
} from "@/lib/sponsorship-ui";
import { sponsorAuthClient } from "@/lib/sponsor-auth-client";

export const Route = createFileRoute("/sponsor/auctions/$auctionId")({
	component: SponsorAuctionDetailRoute,
});

function toSponsorBidErrorMessage(error: unknown): string {
	if (!(error instanceof Error)) {
		return "Failed to submit bid.";
	}
	if (error.message.startsWith("Bid must be at least ")) {
		return error.message;
	}
	if (error.message.startsWith("Max amount must be at least ")) {
		return error.message;
	}
	const allowedMessages = new Set([
		"Bidding is not open for this auction.",
		"Auction has already closed.",
		"Bid amount must be at least EUR 1.00.",
		"Max amount must be greater than or equal to bid amount.",
		"Enter a bid amount or max amount.",
		"Enter a bid amount.",
		"Sponsor session expired. Please sign in again.",
		"You are not invited to this auction.",
		"Auction not found.",
		"Max bids are only available for Proxy Bidding auctions.",
		"Max bids are not available for sealed auctions.",
	]);
	if (allowedMessages.has(error.message)) {
		return error.message;
	}
	return "Failed to submit bid.";
}

function SponsorAuctionDetailRoute() {
	if (!isSponsorshipEnabled) {
		return <Navigate to="/" />;
	}
	return <SponsorAuctionDetailEnabled />;
}

function SponsorAuctionDetailEnabled() {
	const navigate = useNavigate();
	const { data: authSession, isPending: authPending } =
		sponsorAuthClient.useSession();
	const sessionToken = authSession?.session.token ?? null;
	const { auctionId } = Route.useParams();
	const typedAuctionId = auctionId as Id<"sponsorshipAuctions">;
	const [amountEuros, setAmountEuros] = useState("");
	const [maxAmountEuros, setMaxAmountEuros] = useState("");
	const [isHowBiddingOpen, setIsHowBiddingOpen] = useState(false);
	const [isSubmittingBid, setIsSubmittingBid] = useState(false);
	const [isSubmittingMaxBid, setIsSubmittingMaxBid] = useState(false);
	const prefilledAuctionIdRef = useRef<string | null>(null);
	const refreshedSummaryAuctionIdRef = useRef<string | null>(null);
	const placeBid = useMutation(api.sponsorPortal.placeBid);
	const setMaxBid = useMutation(api.sponsorPortal.setMaxBid);
	const refreshCompetitionSnapshot = useAction(
		api.sponsorshipAuctions.refreshCompetitionSnapshot,
	);

	useEffect(() => {
		if (authPending) return;
		if (sessionToken !== null) return;
		void navigate({ to: "/sponsor/login" });
	}, [authPending, navigate, sessionToken]);

	const data = useQuery(
		api.sponsorPortal.getAuction,
		sessionToken
			? {
					sessionToken,
					auctionId: typedAuctionId,
				}
			: "skip",
	);

	useEffect(() => {
		if (!data) return;
		const currentAuctionId = String(data.auction.id);
		if (prefilledAuctionIdRef.current === currentAuctionId) return;
		prefilledAuctionIdRef.current = currentAuctionId;
		if (!isProxySponsorshipFramework(data.auction.framework)) {
			setMaxAmountEuros("");
			return;
		}
		setMaxAmountEuros(
			data.myMaxBidCents !== undefined
				? (data.myMaxBidCents / 100).toFixed(2)
				: "",
		);
	}, [data]);

	useEffect(() => {
		if (!data || !sessionToken) return;
		if (data.auction.competitionSummarySource === "wca") return;
		const auctionIdToRefresh = String(data.auction.id);
		if (refreshedSummaryAuctionIdRef.current === auctionIdToRefresh) return;
		refreshedSummaryAuctionIdRef.current = auctionIdToRefresh;
		void refreshCompetitionSnapshot({
			auctionId: data.auction.id,
			sessionToken,
		});
	}, [data, refreshCompetitionSnapshot, sessionToken]);

	if (authPending) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}
	if (!sessionToken) return null;
	if (data === null) {
		return <Navigate to="/sponsor/auctions" />;
	}

	const isProxyAuction =
		data !== undefined && isProxySponsorshipFramework(data.auction.framework);
	const minimumNextBidCents = data?.auction.minimumNextBidCents ?? 100;
	const minimumNextBidEuros = (minimumNextBidCents / 100).toFixed(2);
	const minimumBidCents = isProxyAuction
		? minimumNextBidCents
		: (data?.auction.startPriceCents ?? 100);
	const minimumBidEuros = (minimumBidCents / 100).toFixed(2);

	const submitBid = async (event: FormEvent) => {
		event.preventDefault();
		const amount = amountEuros.length
			? Math.round(Number(amountEuros) * 100)
			: undefined;
		if (amount === undefined) {
			toast.error("Enter a bid amount.");
			return;
		}
		if (!Number.isFinite(amount) || amount <= 0) {
			toast.error("Enter a valid bid amount.");
			return;
		}
		if (amount < minimumBidCents) {
			toast.error(
				`Bid must be at least ${formatEuroFromCents(minimumBidCents)}.`,
			);
			return;
		}

		setIsSubmittingBid(true);
		try {
			await placeBid({
				sessionToken,
				auctionId: typedAuctionId,
				amountCents: amount,
			});
			toast.success(
				isProxyAuction ? "Bid submitted." : "Sealed bid submitted.",
			);
			setAmountEuros("");
		} catch (error) {
			toast.error(toSponsorBidErrorMessage(error));
		} finally {
			setIsSubmittingBid(false);
		}
	};

	const submitMaxBid = async (event: FormEvent) => {
		event.preventDefault();
		if (!isProxyAuction) {
			toast.error("Max bids are only available for Proxy Bidding auctions.");
			return;
		}
		const max = maxAmountEuros.length
			? Math.round(Number(maxAmountEuros) * 100)
			: undefined;
		if (max === undefined || !Number.isFinite(max) || max <= 0) {
			toast.error("Enter a valid max amount.");
			return;
		}
		if (max < minimumNextBidCents) {
			toast.error(
				`Max amount must be at least ${formatEuroFromCents(minimumNextBidCents)}.`,
			);
			return;
		}

		setIsSubmittingMaxBid(true);
		try {
			await setMaxBid({
				sessionToken,
				auctionId: typedAuctionId,
				maxAmountCents: max,
			});
			toast.success("Max bid updated.");
			setMaxAmountEuros((max / 100).toFixed(2));
		} catch (error) {
			toast.error(toSponsorBidErrorMessage(error));
		} finally {
			setIsSubmittingMaxBid(false);
		}
	};

	const maxBidFormHint =
		"Set the highest amount you are willing to pay. Automatic bidding can go up to this amount.";
	const auctionEnded =
		data?.auction.state === "closed" ||
		(data?.auction.endsAt !== undefined && Date.now() >= data.auction.endsAt);
	const closingStatusText =
		data?.auction === undefined
			? ""
			: auctionEnded
				? `Closed ${formatDistanceToNow(new Date(data.auction.endsAt), {
						addSuffix: true,
					})}`
				: `${formatDateTime(data.auction.endsAt)} (${formatDistanceToNow(
						new Date(data.auction.endsAt),
						{ addSuffix: true },
					)})`;
	const isSealedPriceHidden =
		data !== undefined &&
		isSealedSponsorshipFramework(data.auction.framework) &&
		data.auction.state !== "closed";
	const isClosedSealedAuction =
		data !== undefined &&
		isSealedSponsorshipFramework(data.auction.framework) &&
		data.auction.state === "closed";
	const currentPriceCentsForDisplay =
		data?.auction.state === "closed"
			? (data.auction.settlementAmountCents ??
				data.auction.currentPriceCents ??
				data.auction.startPriceCents)
			: (data?.auction.currentPriceCents ?? data?.auction.startPriceCents ?? 0);

	return (
		<SponsorPageShell maxWidthClassName="max-w-5xl">
			<SponsorPageHeader
				title={data?.auction.competitionName ?? "Auction detail"}
				actions={
					<Button
						variant="outline"
						onClick={() => void navigate({ to: "/sponsor/auctions" })}
					>
						<ArrowLeft className="size-4" />
						Back to auctions
					</Button>
				}
			/>

			{data === undefined ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</div>
			) : (
				<>
					<section className="space-y-3 rounded-lg border bg-card p-4">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant={sponsorshipStateBadgeVariant(data.auction.state)}>
								{sponsorshipStateLabel(data.auction.state)}
							</Badge>
							<Badge variant="outline">
								{sponsorshipFrameworkLabel(data.auction.framework)}
							</Badge>
							<Button
								type="button"
								variant="link"
								className="h-auto p-0"
								onClick={() => setIsHowBiddingOpen((current) => !current)}
							>
								{SPONSORSHIP_BIDDING_HELP_TITLE}
							</Button>
						</div>
						{isHowBiddingOpen ? (
							<AuctionBiddingHelpAlert framework={data.auction.framework} />
						) : null}
						<div className="space-y-2 text-sm">
							<p className="text-muted-foreground">
								<span className="font-medium text-foreground">Closes: </span>
								{closingStatusText}
							</p>
							<div className="space-y-1">
								<p className="font-medium">
									{isClosedSealedAuction ? "Winning bid" : "Current price"}
								</p>
								<div className="flex flex-wrap items-center gap-2">
									<p className="text-2xl font-semibold tabular-nums">
										{isSealedPriceHidden
											? "Sealed until close"
											: formatEuroFromCents(currentPriceCentsForDisplay)}
									</p>
									<SponsorBidStatusBadge
										status={data.auction.sponsorBidStatus}
										showDot
									/>
								</div>
							</div>
							<p className="text-muted-foreground">
								<span className="font-medium text-foreground">
									My last bid:
								</span>{" "}
								{data.myLastBidCents !== undefined
									? formatEuroFromCents(data.myLastBidCents)
									: "Not set"}
							</p>
							{isProxyAuction ? (
								<p className="text-muted-foreground">
									<span className="font-medium text-foreground">
										My max bid:
									</span>{" "}
									{data.myMaxBidCents !== undefined
										? formatEuroFromCents(data.myMaxBidCents)
										: "Not set"}
								</p>
							) : null}
						</div>
					</section>
					<AuctionCompetitionSummaryPanel
						summary={data.auction.competitionSummary}
						source={data.auction.competitionSummarySource}
					/>

					{data.auction.state === "active" ? (
						<div className="space-y-4">
							<Card>
								<CardHeader>
									<CardTitle>Place Bid</CardTitle>
									<CardDescription>
										{isProxyAuction
											? "Submit a direct bid amount."
											: "Submit a sealed bid. You can raise or lower it before close; only your latest bid is counted."}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="mb-3 border-l-2 border-primary/40 pl-3">
										<p className="text-xs uppercase tracking-wide text-muted-foreground">
											{isProxyAuction
												? "Current minimum next bid"
												: "Competition minimum bid"}
										</p>
										<p className="text-xl font-semibold tabular-nums leading-none">
											{formatEuroFromCents(minimumBidCents)}
										</p>
										{!isProxyAuction ? (
											<p className="mt-1 text-xs text-muted-foreground">
												No minimum increment ladder applies in sealed mode.
											</p>
										) : null}
									</div>
									<form
										className="grid gap-3 sm:grid-cols-[1fr_auto]"
										onSubmit={submitBid}
									>
										<div className="space-y-2">
											<Label htmlFor="amount">Bid amount (EUR)</Label>
											<Input
												id="amount"
												type="number"
												min={minimumBidEuros}
												step="0.01"
												value={amountEuros}
												onChange={(event) => setAmountEuros(event.target.value)}
												placeholder={minimumBidEuros}
												disabled={isSubmittingBid}
											/>
										</div>
										<div className="flex items-end">
											<Button
												type="submit"
												className="w-full"
												disabled={isSubmittingBid}
											>
												{isSubmittingBid ? (
													<Loader2 className="size-4 animate-spin" />
												) : isProxyAuction ? (
													"Submit bid"
												) : (
													"Submit sealed bid"
												)}
											</Button>
										</div>
									</form>
								</CardContent>
							</Card>

							{isProxyAuction ? (
								<Card>
									<CardHeader>
										<CardTitle>Set Max Bid</CardTitle>
										<CardDescription>{maxBidFormHint}</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="mb-3 border-l-2 border-primary/40 pl-3">
											<p className="text-xs uppercase tracking-wide text-muted-foreground">
												Current max bid
											</p>
											<p className="text-xl font-semibold tabular-nums leading-none">
												{data.myMaxBidCents !== undefined
													? formatEuroFromCents(data.myMaxBidCents)
													: "Not set"}
											</p>
										</div>
										<form
											className="grid gap-3 sm:grid-cols-[1fr_auto]"
											onSubmit={submitMaxBid}
										>
											<div className="space-y-2">
												<Label htmlFor="max">Max amount (EUR)</Label>
												<Input
													id="max"
													type="number"
													min={minimumNextBidEuros}
													step="0.01"
													value={maxAmountEuros}
													onChange={(event) =>
														setMaxAmountEuros(event.target.value)
													}
													placeholder={minimumNextBidEuros}
													disabled={isSubmittingMaxBid}
												/>
											</div>
											<div className="flex items-end">
												<Button
													type="submit"
													className="w-full"
													disabled={isSubmittingMaxBid}
												>
													{isSubmittingMaxBid ? (
														<Loader2 className="size-4 animate-spin" />
													) : (
														"Save max bid"
													)}
												</Button>
											</div>
										</form>
									</CardContent>
								</Card>
							) : null}
						</div>
					) : (
						<Card>
							<CardContent className="py-4 text-sm text-muted-foreground">
								Bidding is not open for this auction.
							</CardContent>
						</Card>
					)}

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ShieldCheck className="size-4" />
								Bid Activity
							</CardTitle>
							<CardDescription>
								{isProxyAuction ? (
									<>
										<Clock3 className="mr-1 inline size-3.5" />
										Your bids are marked as You. Other sponsors are anonymized.
									</>
								) : (
									"Sealed bid activity is hidden until auction close."
								)}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							{!isProxyAuction ? (
								<div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
									Only your own submitted amount is visible in your bid form.
								</div>
							) : !data.bidHistoryVisible ? (
								<div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
									Bid history is unavailable until bidding opens.
								</div>
							) : data.events.length === 0 ? (
								<div className="text-sm text-muted-foreground">
									No bids yet.
								</div>
							) : (
								data.events
									.slice()
									.reverse()
									.map((event) => (
										<div
											key={event.id}
											className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm"
										>
											<div className="flex items-center gap-2">
												<Badge
													variant={event.isOwnBid ? "default" : "secondary"}
												>
													{event.sponsorLabel}
												</Badge>
												<span className="font-medium tabular-nums">
													{formatEuroFromCents(event.amountCents)}
												</span>
												<Badge variant="outline">
													{event.isOwnBid
														? event.isAuto
															? "Auto"
															: "Manual"
														: "Bid"}
												</Badge>
											</div>
											<span className="text-xs text-muted-foreground">
												{formatDateTime(event.createdAt)}
											</span>
										</div>
									))
							)}
						</CardContent>
					</Card>
				</>
			)}
		</SponsorPageShell>
	);
}
