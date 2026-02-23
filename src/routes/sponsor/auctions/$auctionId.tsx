import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AuctionBiddingHelpAlert } from "@/components/sponsorship/auction-bidding-help";
import {
	AuctionAmountEntryCard,
	AuctionBidActivityCard,
	AuctionBiddingSummaryCard,
} from "@/components/sponsorship/auction-bidding-cards";
import { AuctionCompetitionSummaryPanel } from "@/components/sponsorship/competition-summary-panel";
import {
	SponsorPageHeader,
	SponsorPageShell,
} from "@/components/sponsorship/sponsor-page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";

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

	const dataResult = useQuery(
		api.sponsorPortal.getAuction,
		sessionToken
			? {
					sessionToken,
					auctionId: typedAuctionId,
				}
			: "skip",
	);
	const dataState = useRetainedQueryResult(
		dataResult,
		sessionToken ? `${sessionToken}:${typedAuctionId}` : "skip",
	);
	const queryData = dataState.data;

	useEffect(() => {
		if (!queryData) return;
		const currentAuctionId = String(queryData.auction.id);
		if (prefilledAuctionIdRef.current === currentAuctionId) return;
		prefilledAuctionIdRef.current = currentAuctionId;
		if (!isProxySponsorshipFramework(queryData.auction.framework)) {
			setMaxAmountEuros("");
			return;
		}
		setMaxAmountEuros(
			queryData.myMaxBidCents !== undefined
				? (queryData.myMaxBidCents / 100).toFixed(2)
				: "",
		);
	}, [queryData]);

	useEffect(() => {
		if (!queryData || !sessionToken) return;
		if (queryData.auction.competitionSummarySource === "wca") return;
		const auctionIdToRefresh = String(queryData.auction.id);
		if (refreshedSummaryAuctionIdRef.current === auctionIdToRefresh) return;
		refreshedSummaryAuctionIdRef.current = auctionIdToRefresh;
		void refreshCompetitionSnapshot({
			auctionId: queryData.auction.id,
			sessionToken,
		});
	}, [queryData, refreshCompetitionSnapshot, sessionToken]);

	if (authPending) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}
	if (!sessionToken) return null;
	if (dataState.isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}
	const data = dataState.data;
	if (data === null) {
		return <Navigate to="/sponsor/auctions" />;
	}

	const isProxyAuction = isProxySponsorshipFramework(data.auction.framework);
	const minimumNextBidCents = data.auction.minimumNextBidCents ?? 100;
	const minimumNextBidEuros = (minimumNextBidCents / 100).toFixed(2);
	const minimumBidCents = isProxyAuction
		? minimumNextBidCents
		: (data.auction.startPriceCents ?? 100);
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
		data.auction.state === "closed" ||
		(data.auction.endsAt !== undefined && Date.now() >= data.auction.endsAt);
	const closingStatusText = auctionEnded
		? `Closed ${formatDistanceToNow(new Date(data.auction.endsAt), {
				addSuffix: true,
			})}`
		: `${formatDateTime(data.auction.endsAt)} (${formatDistanceToNow(
				new Date(data.auction.endsAt),
				{ addSuffix: true },
			)})`;
	const isSealedPriceHidden =
		isSealedSponsorshipFramework(data.auction.framework) &&
		data.auction.state !== "closed";
	const isClosedSealedAuction =
		isSealedSponsorshipFramework(data.auction.framework) &&
		data.auction.state === "closed";
	const currentPriceCentsForDisplay =
		data.auction.state === "closed"
			? (data.auction.settlementAmountCents ??
				data.auction.currentPriceCents ??
				data.auction.startPriceCents)
			: (data.auction.currentPriceCents ?? data.auction.startPriceCents ?? 0);
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
		}));

	return (
		<SponsorPageShell maxWidthClassName="max-w-5xl">
			<SponsorPageHeader
				title={data.auction.competitionName}
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

			<AuctionBiddingSummaryCard
				stateLabel={sponsorshipStateLabel(data.auction.state)}
				stateVariant={sponsorshipStateBadgeVariant(data.auction.state)}
				frameworkLabel={sponsorshipFrameworkLabel(data.auction.framework)}
				helpTitle={SPONSORSHIP_BIDDING_HELP_TITLE}
				onHelpToggle={() => setIsHowBiddingOpen((current) => !current)}
				helpContent={
					isHowBiddingOpen ? (
						<AuctionBiddingHelpAlert framework={data.auction.framework} />
					) : null
				}
				closesAtText={closingStatusText}
				priceLabel={isClosedSealedAuction ? "Winning bid" : "Current price"}
				priceValue={
					isSealedPriceHidden
						? "Sealed until close"
						: formatEuroFromCents(currentPriceCentsForDisplay)
				}
				sponsorBidStatus={data.auction.sponsorBidStatus}
				myLastBidText={
					data.myLastBidCents !== undefined
						? formatEuroFromCents(data.myLastBidCents)
						: "Not set"
				}
				myMaxBidText={
					isProxyAuction
						? data.myMaxBidCents !== undefined
							? formatEuroFromCents(data.myMaxBidCents)
							: "Not set"
						: undefined
				}
			/>
			<AuctionCompetitionSummaryPanel
				summary={data.auction.competitionSummary}
				source={data.auction.competitionSummarySource}
			/>

			{data.auction.state === "active" ? (
				<div className="space-y-4">
					<AuctionAmountEntryCard
						title="Place Bid"
						description={
							isProxyAuction
								? "Submit a direct bid amount."
								: "Submit a sealed bid. You can raise or lower it before close; only your latest bid is counted."
						}
						minimumLabel={
							isProxyAuction
								? "Current minimum next bid"
								: "Competition minimum bid"
						}
						minimumValue={formatEuroFromCents(minimumBidCents)}
						minimumHint={
							!isProxyAuction
								? "No minimum increment ladder applies in sealed mode."
								: undefined
						}
						inputId="amount"
						inputLabel="Bid amount (EUR)"
						inputValue={amountEuros}
						inputMin={minimumBidEuros}
						inputPlaceholder={minimumBidEuros}
						onInputChange={setAmountEuros}
						onSubmit={submitBid}
						submitLabel={isProxyAuction ? "Submit bid" : "Submit sealed bid"}
						isSubmitting={isSubmittingBid}
					/>

					{isProxyAuction ? (
						<AuctionAmountEntryCard
							title="Set Max Bid"
							description={maxBidFormHint}
							minimumLabel="Current max bid"
							minimumValue={
								data.myMaxBidCents !== undefined
									? formatEuroFromCents(data.myMaxBidCents)
									: "Not set"
							}
							inputId="max"
							inputLabel="Max amount (EUR)"
							inputValue={maxAmountEuros}
							inputMin={minimumNextBidEuros}
							inputPlaceholder={minimumNextBidEuros}
							onInputChange={setMaxAmountEuros}
							onSubmit={submitMaxBid}
							submitLabel="Save max bid"
							isSubmitting={isSubmittingMaxBid}
						/>
					) : null}
				</div>
			) : (
				<Card>
					<CardContent className="py-4 text-sm text-muted-foreground">
						Bidding is not open for this auction.
					</CardContent>
				</Card>
			)}

			<AuctionBidActivityCard
				isProxyAuction={isProxyAuction}
				description={
					isProxyAuction
						? "Your bids are marked as You. Other sponsors are anonymized."
						: "Sealed bid activity is hidden until auction close."
				}
				bidHistoryVisible={data.bidHistoryVisible}
				items={bidActivityItems}
				sealedMessage="Only your own submitted amount is visible in your bid form."
				unavailableMessage="Bid history is unavailable until bidding opens."
				emptyMessage="No bids yet."
			/>
		</SponsorPageShell>
	);
}
