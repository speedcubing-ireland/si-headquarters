import { createFileRoute, Navigate } from "@tanstack/react-router";
import {
	Gavel,
	Lock,
	LockOpen,
	Loader2,
	Plus,
	RefreshCw,
	Send,
	ShieldX,
	Trash2,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { AuctionBiddingHelpOverview } from "@/components/sponsorship/auction-bidding-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AppPageHeader } from "@/components/shared/page-header";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	useIsSponsorshipManager,
	useSponsorshipAuctionManagerView,
	useSponsorshipAuctionMutations,
	useSponsorshipAuctionsForManager,
	useSponsorshipCompetitionsForManager,
	useSponsorMutations,
	useSponsors,
} from "@/hooks/use-convex-data";
import { isSponsorshipEnabled } from "@/lib/feature-flags";
import {
	SPONSORSHIP_FRAMEWORKS,
	formatDateTime,
	formatEuroFromCents,
	isSponsorshipFramework,
	isSealedSponsorshipFramework,
	type SponsorshipFramework,
	sponsorshipFrameworkLabel,
	sponsorshipStateBadgeVariant,
	sponsorshipStateLabel,
} from "@/lib/sponsorship-ui";

export const Route = createFileRoute("/admin/sponsorship")({
	component: SponsorshipAdminRoute,
});

function toDatetimeLocalInput(date: Date): string {
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

function parseDatetimeLocalInput(value: string): number | null {
	const millis = new Date(value).getTime();
	return Number.isFinite(millis) ? millis : null;
}

function centsToEuroInput(cents: number | undefined): string {
	if (cents === undefined) return "";
	return (cents / 100).toFixed(2);
}

function normalizeSearchText(value: string): string {
	return value.trim().toLowerCase();
}

function hasSameIdSet<T>(left: T[], right: T[]): boolean {
	if (left.length !== right.length) return false;
	const sortedLeft = left.map((value) => String(value)).sort();
	const sortedRight = right.map((value) => String(value)).sort();
	return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function sponsorPropertyStatusLabel(
	status: "none" | "not_offered" | "bidding" | "sponsor",
): string {
	switch (status) {
		case "bidding":
			return "Bidding in progress";
		case "sponsor":
			return "Sponsored";
		case "not_offered":
			return "Not offered";
		default:
			return "No sponsor yet";
	}
}

function formatCompetitionSummaryDateRange(summary: {
	startDate: string;
	endDate: string;
}): string {
	const start = summary.startDate.trim() || "TBC";
	const end = summary.endDate.trim() || "TBC";
	return start === end ? start : `${start} - ${end}`;
}

type SponsorBidOutcomeDisplay = {
	sponsorId: Id<"sponsors">;
	sponsorName: string;
	isWinner: boolean;
	isInvited: boolean;
	validBidCount: number;
	totalBidCount: number;
	latestValidBidCents?: number;
	latestValidBidAt?: number;
	latestValidBidMode?: "proxy" | "manual";
};

type InvitedSponsorDisplay = {
	sponsorId: Id<"sponsors">;
	sponsorName: string;
};

function AuctionSponsorBidBreakdown(props: {
	outcomes: SponsorBidOutcomeDisplay[];
	flat?: boolean;
}) {
	return (
		<div
			className={props.flat ? "space-y-1" : "space-y-1 rounded-md border p-2"}
		>
			<p className="text-xs text-muted-foreground">Sponsor bid breakdown</p>
			{props.outcomes.length === 0 ? (
				<p className="text-xs text-muted-foreground">
					No sponsor outcomes available.
				</p>
			) : (
				props.outcomes.map((outcome) => (
					<div
						key={`outcome-${outcome.sponsorId}`}
						className="flex items-center justify-between gap-3 rounded border px-2 py-1.5"
					>
						<div className="min-w-0">
							<p className="truncate text-sm font-medium">
								{outcome.sponsorName}
							</p>
							<p className="text-xs text-muted-foreground">
								{outcome.isWinner
									? "Winner"
									: outcome.validBidCount > 0
										? "Bidder"
										: "No valid bid"}{" "}
								· {outcome.isInvited ? "Invited" : "Not invited"} · Valid bids:{" "}
								{outcome.validBidCount}/{outcome.totalBidCount}
							</p>
						</div>
						<div className="text-right">
							<p className="text-sm font-medium tabular-nums">
								{outcome.latestValidBidCents !== undefined
									? formatEuroFromCents(outcome.latestValidBidCents)
									: "No valid bid"}
							</p>
							<p className="text-xs text-muted-foreground">
								{outcome.latestValidBidAt
									? `${outcome.latestValidBidMode === "proxy" ? "Proxy" : "Manual"} · ${formatDateTime(outcome.latestValidBidAt)}`
									: "No final valid bid"}
							</p>
						</div>
					</div>
				))
			)}
		</div>
	);
}

function AuctionBidStatusSection(props: {
	intentCount: number;
	eventCount: number;
	invitedSponsors?: InvitedSponsorDisplay[];
	outcomes: SponsorBidOutcomeDisplay[];
	flatBreakdown?: boolean;
}) {
	return (
		<div className="space-y-2">
			<div className="flex flex-wrap gap-2">
				<Badge variant="outline">Bid intents: {props.intentCount}</Badge>
				<Badge variant="outline">Bid events: {props.eventCount}</Badge>
				{props.invitedSponsors ? (
					<Badge variant="outline">
						Invited sponsors: {props.invitedSponsors.length}
					</Badge>
				) : null}
			</div>
			{props.invitedSponsors ? (
				<div className="space-y-1 rounded-md border p-2">
					<p className="text-xs text-muted-foreground">Invited sponsors</p>
					{props.invitedSponsors.length === 0 ? (
						<p className="text-xs text-muted-foreground">
							No invited sponsors on record.
						</p>
					) : (
						<div className="flex flex-wrap gap-1.5">
							{props.invitedSponsors.map((sponsor) => (
								<Badge
									key={`invite-${sponsor.sponsorId}`}
									variant="secondary"
									className="text-[11px]"
								>
									{sponsor.sponsorName}
								</Badge>
							))}
						</div>
					)}
				</div>
			) : null}
			<AuctionSponsorBidBreakdown
				outcomes={props.outcomes}
				flat={props.flatBreakdown}
			/>
		</div>
	);
}

function SponsorshipAdminRoute() {
	if (!isSponsorshipEnabled) {
		return <Navigate to="/" />;
	}
	return <SponsorshipAdminGate />;
}

function SponsorshipAdminGate() {
	const { isManager, isLoading } = useIsSponsorshipManager();
	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}
	if (!isManager) {
		return <Navigate to="/" />;
	}
	return <SponsorshipAdminContent />;
}

function SponsorshipAdminContent() {
	const { competitions, isLoading: isLoadingCompetitions } =
		useSponsorshipCompetitionsForManager();
	const { auctions, isLoading: isLoadingAuctions } =
		useSponsorshipAuctionsForManager();
	const { sponsors, isLoading: isLoadingSponsors } = useSponsors();
	const {
		createSponsor,
		archiveSponsor,
		unarchiveSponsor,
		sendAccessEmail,
		revokeSessions,
	} = useSponsorMutations();
	const {
		createAuction,
		updateAuction,
		refreshCompetitionSnapshot,
		startAuction,
		closeAuction,
		deleteBeforeOpen,
	} = useSponsorshipAuctionMutations();

	const [activeTab, setActiveTab] = useState<
		"open" | "closed" | "sponsors" | "auctionTypes"
	>("open");
	const [openSearchQuery, setOpenSearchQuery] = useState("");
	const [closedSearchQuery, setClosedSearchQuery] = useState("");
	const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
	const [selectedAuctionId, setSelectedAuctionId] =
		useState<Id<"sponsorshipAuctions"> | null>(null);
	const [selectedClosedAuctionId, setSelectedClosedAuctionId] =
		useState<Id<"sponsorshipAuctions"> | null>(null);
	const { managerView, isLoading: isLoadingManagerView } =
		useSponsorshipAuctionManagerView(
			editorMode === "edit" ? selectedAuctionId : null,
		);
	const {
		managerView: closedAuctionManagerView,
		isLoading: isLoadingClosedAuctionManagerView,
	} = useSponsorshipAuctionManagerView(selectedClosedAuctionId);

	const [createCompetitionId, setCreateCompetitionId] =
		useState<Id<"competitions"> | null>(null);
	const [createStartsAtInput, setCreateStartsAtInput] = useState(() =>
		toDatetimeLocalInput(new Date(Date.now() + 60 * 60 * 1000)),
	);
	const [createEndsAtInput, setCreateEndsAtInput] = useState(() =>
		toDatetimeLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000)),
	);
	const [createFramework, setCreateFramework] =
		useState<SponsorshipFramework>("first_sealed");
	const [isCreateFrameworkUnlocked, setIsCreateFrameworkUnlocked] =
		useState(false);
	const [createStartPriceEuros, setCreateStartPriceEuros] = useState("100");
	const [createInvitedSponsorIds, setCreateInvitedSponsorIds] = useState<
		Id<"sponsors">[]
	>([]);

	const [editFramework, setEditFramework] =
		useState<SponsorshipFramework>("first_sealed");
	const [isEditFrameworkUnlocked, setIsEditFrameworkUnlocked] = useState(false);
	const [editStartsAtInput, setEditStartsAtInput] = useState("");
	const [editEndsAtInput, setEditEndsAtInput] = useState("");
	const [editStartPriceEuros, setEditStartPriceEuros] = useState("");
	const [editInvitedSponsorIds, setEditInvitedSponsorIds] = useState<
		Id<"sponsors">[]
	>([]);

	const [isCreatingAuction, setIsCreatingAuction] = useState(false);
	const [isSavingAuction, setIsSavingAuction] = useState(false);
	const [busyAuctionId, setBusyAuctionId] =
		useState<Id<"sponsorshipAuctions"> | null>(null);
	const [refreshingAuctionId, setRefreshingAuctionId] =
		useState<Id<"sponsorshipAuctions"> | null>(null);

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const [isSubmittingSponsor, setIsSubmittingSponsor] = useState(false);
	const [busySponsorId, setBusySponsorId] = useState<Id<"sponsors"> | null>(
		null,
	);

	const activeSponsors = useMemo(
		() => sponsors.filter((sponsor) => sponsor.active),
		[sponsors],
	);
	const sponsorById = useMemo(
		() => new Map(sponsors.map((sponsor) => [sponsor.id, sponsor])),
		[sponsors],
	);
	const auctionById = useMemo(
		() => new Map(auctions.map((auction) => [auction.id, auction])),
		[auctions],
	);
	const competitionById = useMemo(
		() =>
			new Map(competitions.map((competition) => [competition.id, competition])),
		[competitions],
	);
	const competitionIdByString = useMemo(
		() =>
			new Map<string, Id<"competitions">>(
				competitions.map((competition) => [
					String(competition.id),
					competition.id,
				]),
			),
		[competitions],
	);

	const openAuctions = useMemo(
		() => auctions.filter((auction) => auction.state !== "closed"),
		[auctions],
	);
	const closedAuctions = useMemo(
		() => auctions.filter((auction) => auction.state === "closed"),
		[auctions],
	);
	const openSearchText = normalizeSearchText(openSearchQuery);
	const closedSearchText = normalizeSearchText(closedSearchQuery);
	const filteredOpenAuctions = useMemo(
		() =>
			openAuctions.filter((auction) => {
				if (!openSearchText) return true;
				return (
					auction.competitionName.toLowerCase().includes(openSearchText) ||
					auction.competitionPhaseName.toLowerCase().includes(openSearchText)
				);
			}),
		[openAuctions, openSearchText],
	);
	const filteredClosedAuctions = useMemo(
		() =>
			closedAuctions.filter((auction) => {
				if (!closedSearchText) return true;
				return (
					auction.competitionName.toLowerCase().includes(closedSearchText) ||
					auction.competitionPhaseName.toLowerCase().includes(closedSearchText)
				);
			}),
		[closedAuctions, closedSearchText],
	);

	const unsponsoredCompetitionsByPhase = useMemo(() => {
		const grouped = new Map<string, (typeof competitions)[number][]>();
		for (const competition of competitions) {
			if (competition.sponsorPropertyStatus === "sponsor") continue;
			const phase = competition.currentPhaseName;
			const current = grouped.get(phase) ?? [];
			current.push(competition);
			grouped.set(phase, current);
		}
		return [...grouped.entries()]
			.map(([phase, items]) => ({
				phase,
				items: items.sort((a, b) => a.compStart.localeCompare(b.compStart)),
			}))
			.sort((a, b) => a.phase.localeCompare(b.phase));
	}, [competitions]);
	const sponsoredCompetitions = useMemo(
		() =>
			competitions
				.filter(
					(competition) => competition.sponsorPropertyStatus === "sponsor",
				)
				.sort((a, b) => a.compStart.localeCompare(b.compStart)),
		[competitions],
	);

	useEffect(() => {
		if (createInvitedSponsorIds.length > 0) return;
		if (activeSponsors.length === 0) return;
		setCreateInvitedSponsorIds(activeSponsors.map((sponsor) => sponsor.id));
	}, [activeSponsors, createInvitedSponsorIds.length]);

	useEffect(() => {
		if (createCompetitionId !== null) return;
		const preferred =
			unsponsoredCompetitionsByPhase[0]?.items[0] ?? competitions[0];
		if (!preferred) return;
		setCreateCompetitionId(preferred.id);
	}, [competitions, createCompetitionId, unsponsoredCompetitionsByPhase]);

	useEffect(() => {
		if (editorMode !== "edit") return;
		if (!selectedAuctionId) return;
		if (auctionById.has(selectedAuctionId)) return;
		setEditorMode("create");
		setSelectedAuctionId(null);
	}, [auctionById, editorMode, selectedAuctionId]);

	useEffect(() => {
		if (!selectedClosedAuctionId) return;
		const selected = auctionById.get(selectedClosedAuctionId);
		if (selected && selected.state === "closed") return;
		setSelectedClosedAuctionId(null);
	}, [auctionById, selectedClosedAuctionId]);

	useEffect(() => {
		if (!managerView || editorMode !== "edit") return;
		setEditFramework(managerView.auction.framework);
		setIsEditFrameworkUnlocked(false);
		setEditStartsAtInput(
			toDatetimeLocalInput(new Date(managerView.auction.startsAt)),
		);
		setEditEndsAtInput(
			toDatetimeLocalInput(new Date(managerView.auction.endsAt)),
		);
		setEditStartPriceEuros(
			centsToEuroInput(managerView.auction.startPriceCents),
		);
		setEditInvitedSponsorIds(managerView.inviteSponsorIds);
	}, [editorMode, managerView]);

	const selectedAuction =
		editorMode === "edit" && selectedAuctionId
			? (auctionById.get(selectedAuctionId) ?? null)
			: null;
	const selectedClosedAuction = useMemo(() => {
		if (selectedClosedAuctionId === null) return null;
		const auction = auctionById.get(selectedClosedAuctionId) ?? null;
		return auction?.state === "closed" ? auction : null;
	}, [auctionById, selectedClosedAuctionId]);
	const selectedClosedAuctionWinnerName = selectedClosedAuction?.winnerSponsorId
		? (sponsorById.get(selectedClosedAuction.winnerSponsorId)?.name ??
			"Unknown sponsor")
		: "No winner";
	const selectedClosedAuctionWinningBidCents = selectedClosedAuction
		? (selectedClosedAuction.settlementAmountCents ??
			selectedClosedAuction.currentPriceCents ??
			selectedClosedAuction.startPriceCents)
		: null;
	const selectedClosedAuctionInvitedSponsors =
		closedAuctionManagerView?.inviteSponsorIds.map((sponsorId) => ({
			sponsorId,
			sponsorName: sponsorById.get(sponsorId)?.name ?? "Unknown sponsor",
		})) ?? [];
	const selectedClosedAuctionSponsorOutcomes: SponsorBidOutcomeDisplay[] = (
		closedAuctionManagerView?.sponsorOutcomes ?? []
	).map((outcome) => ({
		...outcome,
		sponsorName: sponsorById.get(outcome.sponsorId)?.name ?? "Unknown sponsor",
	}));
	const selectedOpenAuctionSponsorOutcomes: SponsorBidOutcomeDisplay[] = (
		managerView?.sponsorOutcomes ?? []
	).map((outcome) => ({
		...outcome,
		sponsorName: sponsorById.get(outcome.sponsorId)?.name ?? "Unknown sponsor",
	}));
	const selectedAuctionCompetitionSummary =
		managerView?.competitionSummary ?? null;
	const selectedAuctionCompetitionSummarySource =
		managerView?.competitionSummarySource ?? null;
	const selectedAuctionCompetitionSummaryFetchedAt =
		managerView?.competitionSummaryFetchedAt;
	const isSelectedAuctionCompetitionSummaryReady =
		selectedAuctionCompetitionSummarySource === "wca";
	const selectedCompetition =
		createCompetitionId !== null
			? (competitionById.get(createCompetitionId) ?? null)
			: null;
	const panelCompetitionId =
		editorMode === "edit"
			? (selectedAuction?.competitionId ?? null)
			: createCompetitionId;
	const previousClosedAuctionsForPanel = useMemo(() => {
		if (!panelCompetitionId) return [];
		return auctions
			.filter(
				(auction) =>
					auction.state === "closed" &&
					auction.competitionId === panelCompetitionId &&
					auction.id !== selectedAuction?.id,
			)
			.sort((a, b) => b.endsAt - a.endsAt)
			.slice(0, 5);
	}, [auctions, panelCompetitionId, selectedAuction?.id]);
	const hasPendingEditChanges = useMemo(() => {
		if (editorMode !== "edit" || !managerView) return false;
		const startsAt = parseDatetimeLocalInput(editStartsAtInput);
		const endsAt = parseDatetimeLocalInput(editEndsAtInput);
		const startPrice = Number(editStartPriceEuros);
		const startPriceCents = Number.isFinite(startPrice)
			? Math.round(startPrice * 100)
			: null;
		return (
			editFramework !== managerView.auction.framework ||
			startsAt !== managerView.auction.startsAt ||
			endsAt !== managerView.auction.endsAt ||
			startPriceCents !== managerView.auction.startPriceCents ||
			!hasSameIdSet(editInvitedSponsorIds, managerView.inviteSponsorIds)
		);
	}, [
		editEndsAtInput,
		editFramework,
		editInvitedSponsorIds,
		editStartPriceEuros,
		editStartsAtInput,
		editorMode,
		managerView,
	]);

	const resetCreatePanel = () => {
		setEditorMode("create");
		setSelectedAuctionId(null);
		setCreateFramework("first_sealed");
		setIsCreateFrameworkUnlocked(false);
		setCreateStartsAtInput(
			toDatetimeLocalInput(new Date(Date.now() + 60 * 60 * 1000)),
		);
		setCreateEndsAtInput(
			toDatetimeLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000)),
		);
		setCreateStartPriceEuros("100");
		setCreateInvitedSponsorIds(activeSponsors.map((sponsor) => sponsor.id));
	};

	const selectAuctionForEditing = (auctionId: Id<"sponsorshipAuctions">) => {
		setSelectedAuctionId(auctionId);
		setEditorMode("edit");
		setIsEditFrameworkUnlocked(false);
	};

	const toggleCreateSponsorInvite = (sponsorId: Id<"sponsors">) => {
		setCreateInvitedSponsorIds((current) =>
			current.includes(sponsorId)
				? current.filter((id) => id !== sponsorId)
				: [...current, sponsorId],
		);
	};

	const toggleEditSponsorInvite = (sponsorId: Id<"sponsors">) => {
		setEditInvitedSponsorIds((current) =>
			current.includes(sponsorId)
				? current.filter((id) => id !== sponsorId)
				: [...current, sponsorId],
		);
	};

	const onCreateAuction = async (event: FormEvent) => {
		event.preventDefault();
		if (!createCompetitionId) {
			toast.error("Select a competition first.");
			return;
		}
		if (createInvitedSponsorIds.length === 0) {
			toast.error("Select at least one invited sponsor.");
			return;
		}
		const startsAt = parseDatetimeLocalInput(createStartsAtInput);
		const endsAt = parseDatetimeLocalInput(createEndsAtInput);
		if (!startsAt || !endsAt || endsAt <= startsAt) {
			toast.error("Enter a valid start/end range.");
			return;
		}
		const startPrice = Number(createStartPriceEuros);
		if (!Number.isFinite(startPrice) || startPrice < 1) {
			toast.error("Start price must be at least EUR 1.00.");
			return;
		}

		setIsCreatingAuction(true);
		try {
			const auctionId = await createAuction({
				competitionId: createCompetitionId,
				framework: createFramework,
				startsAt,
				endsAt,
				startPriceCents: Math.round(startPrice * 100),
				invitedSponsorIds: createInvitedSponsorIds,
			});
			toast.success("Auction draft created.");
			void onRefreshAuctionCompetitionData(auctionId, false);
			setSelectedAuctionId(auctionId);
			setEditorMode("edit");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create auction.";
			toast.error(message);
		} finally {
			setIsCreatingAuction(false);
		}
	};

	const onSaveAuctionChanges = async (event: FormEvent) => {
		event.preventDefault();
		if (!selectedAuctionId || !managerView) return;
		if (
			managerView.auction.state === "active" ||
			managerView.auction.state === "closed"
		) {
			toast.error("Only draft or scheduled auctions can be edited.");
			return;
		}
		if (editInvitedSponsorIds.length === 0) {
			toast.error("Select at least one invited sponsor.");
			return;
		}
		const startsAt = parseDatetimeLocalInput(editStartsAtInput);
		const endsAt = parseDatetimeLocalInput(editEndsAtInput);
		if (!startsAt || !endsAt || endsAt <= startsAt) {
			toast.error("Enter a valid start/end range.");
			return;
		}
		const startPrice = Number(editStartPriceEuros);
		if (!Number.isFinite(startPrice) || startPrice < 1) {
			toast.error("Start price must be at least EUR 1.00.");
			return;
		}

		setIsSavingAuction(true);
		try {
			await updateAuction({
				auctionId: selectedAuctionId,
				framework: editFramework,
				startsAt,
				endsAt,
				startPriceCents: Math.round(startPrice * 100),
				invitedSponsorIds: editInvitedSponsorIds,
			});
			await refreshCompetitionSnapshot(selectedAuctionId).catch(
				() => undefined,
			);
			toast.success("Auction updated.");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to update auction.";
			toast.error(message);
		} finally {
			setIsSavingAuction(false);
		}
	};

	const onRefreshAuctionCompetitionData = async (
		auctionId: Id<"sponsorshipAuctions">,
		notify = true,
	) => {
		setRefreshingAuctionId(auctionId);
		try {
			const result = await refreshCompetitionSnapshot(auctionId);
			if (notify) {
				if (result.status === "ready") {
					toast.success("Competition details synced from WCA.");
				} else {
					toast.error(result.message);
				}
			}
			return result;
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to refresh competition details.";
			if (notify) {
				toast.error(message);
			}
			throw error;
		} finally {
			setRefreshingAuctionId(null);
		}
	};

	const onStartAuction = async (auctionId: Id<"sponsorshipAuctions">) => {
		if (hasPendingEditChanges) {
			toast.error("Save pending changes before starting this auction.");
			return;
		}
		setBusyAuctionId(auctionId);
		try {
			const refreshResult = await onRefreshAuctionCompetitionData(
				auctionId,
				false,
			);
			if (refreshResult.status !== "ready") {
				toast.error(refreshResult.message);
				return;
			}
			await startAuction(auctionId);
			toast.success("Auction started.");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to start auction.";
			toast.error(message);
		} finally {
			setBusyAuctionId(null);
		}
	};

	const onCloseAuction = async (auctionId: Id<"sponsorshipAuctions">) => {
		if (hasPendingEditChanges) {
			toast.error("Save pending changes before closing this auction.");
			return;
		}
		setBusyAuctionId(auctionId);
		try {
			await closeAuction(auctionId);
			toast.success("Auction closed.");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to close auction.";
			toast.error(message);
		} finally {
			setBusyAuctionId(null);
		}
	};

	const onDeleteBeforeOpen = async (auctionId: Id<"sponsorshipAuctions">) => {
		const shouldDelete = window.confirm(
			"Delete this draft/scheduled auction? This cannot be undone.",
		);
		if (!shouldDelete) return;
		setBusyAuctionId(auctionId);
		try {
			await deleteBeforeOpen(auctionId);
			toast.success("Auction deleted.");
			if (selectedAuctionId === auctionId) {
				resetCreatePanel();
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to delete auction.";
			toast.error(message);
		} finally {
			setBusyAuctionId(null);
		}
	};

	const onCreateSponsor = async (event: FormEvent) => {
		event.preventDefault();
		setIsSubmittingSponsor(true);
		try {
			await createSponsor({
				name,
				email,
				avatarUrl: avatarUrl || undefined,
			});
			toast.success("Sponsor created.");
			setName("");
			setEmail("");
			setAvatarUrl("");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create sponsor.";
			toast.error(message);
		} finally {
			setIsSubmittingSponsor(false);
		}
	};

	const onSendAccessEmail = async (sponsorId: Id<"sponsors">) => {
		setBusySponsorId(sponsorId);
		try {
			await sendAccessEmail(sponsorId);
			toast.success("Sponsor access email sent.");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to send access email.";
			toast.error(message);
		} finally {
			setBusySponsorId(null);
		}
	};

	const onResetSessions = async (sponsorId: Id<"sponsors">) => {
		setBusySponsorId(sponsorId);
		try {
			await revokeSessions(sponsorId);
			toast.success("Sponsor sessions revoked.");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to revoke sessions.";
			toast.error(message);
		} finally {
			setBusySponsorId(null);
		}
	};

	const onArchiveSponsor = async (sponsorId: Id<"sponsors">) => {
		const shouldArchive = window.confirm(
			"Archive this sponsor? They will lose portal access until unarchived.",
		);
		if (!shouldArchive) return;
		setBusySponsorId(sponsorId);
		try {
			await archiveSponsor(sponsorId);
			toast.success("Sponsor archived and active sessions revoked.");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to archive sponsor.";
			toast.error(message);
		} finally {
			setBusySponsorId(null);
		}
	};

	const onUnarchiveSponsor = async (sponsorId: Id<"sponsors">) => {
		setBusySponsorId(sponsorId);
		try {
			await unarchiveSponsor(sponsorId);
			toast.success("Sponsor reactivated.");
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to reactivate sponsor.";
			toast.error(message);
		} finally {
			setBusySponsorId(null);
		}
	};

	const renderAuctionTable = (input: {
		rows: typeof auctions;
		emptyText: string;
		selectedId: Id<"sponsorshipAuctions"> | null;
		actionLabel: string;
		onSelect: (auctionId: Id<"sponsorshipAuctions">) => void;
	}) => {
		const { rows, emptyText, selectedId, actionLabel, onSelect } = input;
		if (isLoadingAuctions) {
			return (
				<div className="flex items-center justify-center py-10">
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</div>
			);
		}
		if (rows.length === 0) {
			return <p className="text-sm text-muted-foreground">{emptyText}</p>;
		}
		return (
			<div className="overflow-x-auto rounded-md border">
				<table className="w-full text-sm">
					<thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
						<tr>
							<th className="px-3 py-2 text-left font-medium">Competition</th>
							<th className="px-3 py-2 text-left font-medium">Phase</th>
							<th className="px-3 py-2 text-left font-medium">State</th>
							<th className="px-3 py-2 text-left font-medium">Framework</th>
							<th className="px-3 py-2 text-left font-medium">Window</th>
							<th className="px-3 py-2 text-left font-medium">Price</th>
							<th className="px-3 py-2 text-right font-medium">Action</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((auction) => {
							const isSelected = selectedId === auction.id;
							const isClosedAuction = auction.state === "closed";
							const displayAmountCents = isClosedAuction
								? (auction.settlementAmountCents ??
									auction.currentPriceCents ??
									auction.startPriceCents)
								: (auction.currentPriceCents ?? auction.startPriceCents);
							const isSealedClosedAuction =
								isSealedSponsorshipFramework(auction.framework) &&
								isClosedAuction;
							return (
								<tr
									key={auction.id}
									className={isSelected ? "bg-primary/5" : ""}
								>
									<td className="px-3 py-2 align-top">
										<div className="space-y-0.5">
											<p className="font-medium">{auction.competitionName}</p>
											<p className="text-xs text-muted-foreground">
												{auction.competitionCompStart}
											</p>
										</div>
									</td>
									<td className="px-3 py-2">{auction.competitionPhaseName}</td>
									<td className="px-3 py-2">
										<Badge
											variant={sponsorshipStateBadgeVariant(auction.state)}
										>
											{sponsorshipStateLabel(auction.state)}
										</Badge>
									</td>
									<td className="px-3 py-2">
										{sponsorshipFrameworkLabel(auction.framework)}
									</td>
									<td className="px-3 py-2 text-xs text-muted-foreground">
										{formatDateTime(auction.startsAt)}
										<br />
										{formatDateTime(auction.endsAt)}
									</td>
									<td className="px-3 py-2">
										<div className="space-y-0.5">
											<p>{formatEuroFromCents(displayAmountCents)}</p>
											{isSealedClosedAuction ? (
												<p className="text-xs text-muted-foreground">
													Winning bid
												</p>
											) : auction.state === "closed" &&
												auction.settlementAmountCents !== undefined ? (
												<p className="text-xs text-muted-foreground">
													Winning bid
												</p>
											) : null}
										</div>
									</td>
									<td className="px-3 py-2 text-right">
										<Button
											size="sm"
											variant="outline"
											onClick={() => onSelect(auction.id)}
										>
											{actionLabel}
										</Button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		);
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<AppPageHeader
				title="Sponsorship Admin"
				subtitle="Directors + Finance Team"
			/>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0 lg:p-6 lg:pt-0">
				<div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
					<Card>
						<CardHeader className="pb-2">
							<CardDescription className="text-xs">
								Open Auctions
							</CardDescription>
							<CardTitle className="text-2xl">{openAuctions.length}</CardTitle>
						</CardHeader>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardDescription className="text-xs">
								Closed Auctions
							</CardDescription>
							<CardTitle className="text-2xl">
								{closedAuctions.length}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardDescription className="text-xs">
								Active Sponsors
							</CardDescription>
							<CardTitle className="text-2xl">
								{activeSponsors.length}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardDescription className="text-xs">
								Needs Sponsor
							</CardDescription>
							<CardTitle className="text-2xl">
								{
									competitions.filter(
										(competition) =>
											competition.sponsorPropertyStatus !== "sponsor",
									).length
								}
							</CardTitle>
						</CardHeader>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardDescription className="text-xs">
								Competition Load
							</CardDescription>
							<CardTitle className="text-2xl">{competitions.length}</CardTitle>
						</CardHeader>
					</Card>
				</div>

				<Tabs
					value={activeTab}
					onValueChange={(value) =>
						setActiveTab(
							value as "open" | "closed" | "sponsors" | "auctionTypes",
						)
					}
					className="space-y-4"
				>
					<TabsList className="grid w-full max-w-2xl grid-cols-4">
						<TabsTrigger value="open">
							<Gavel className="size-4" />
							Open
						</TabsTrigger>
						<TabsTrigger value="closed">Closed</TabsTrigger>
						<TabsTrigger value="auctionTypes">Auction Types</TabsTrigger>
						<TabsTrigger value="sponsors">
							<Users className="size-4" />
							Sponsors
						</TabsTrigger>
					</TabsList>

					<TabsContent value="open" className="space-y-4">
						<div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
							<Card>
								<CardHeader>
									<CardTitle>Draft, Scheduled, and Active Auctions</CardTitle>
									<CardDescription>
										Select an auction to edit details and manage its lifecycle.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="flex flex-wrap items-center gap-2">
										<Input
											placeholder="Search competitions or phases"
											value={openSearchQuery}
											onChange={(event) =>
												setOpenSearchQuery(event.target.value)
											}
											className="max-w-sm"
										/>
										<Button
											variant="outline"
											onClick={() => resetCreatePanel()}
										>
											<Plus className="size-4" />
											New auction draft
										</Button>
									</div>
									{renderAuctionTable({
										rows: filteredOpenAuctions,
										emptyText: "No open auctions.",
										selectedId: selectedAuctionId,
										actionLabel: "Edit",
										onSelect: selectAuctionForEditing,
									})}
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>
										{editorMode === "create"
											? "Create Sponsorship Auction"
											: "Edit Sponsorship Auction"}
									</CardTitle>
									<CardDescription>
										{editorMode === "create"
											? "Create a draft for a competition."
											: "Manage selected auction lifecycle and invites."}
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{editorMode === "create" ? (
										<form className="space-y-3" onSubmit={onCreateAuction}>
											<div className="space-y-2">
												<p className="text-xs text-muted-foreground">
													Competition
												</p>
												<Select
													value={createCompetitionId ?? ""}
													onValueChange={(value) =>
														setCreateCompetitionId(
															competitionIdByString.get(value) ?? null,
														)
													}
												>
													<SelectTrigger className="w-full">
														<SelectValue placeholder="Select competition" />
													</SelectTrigger>
													<SelectContent>
														{unsponsoredCompetitionsByPhase.map((group) => (
															<SelectGroup key={group.phase}>
																<SelectLabel>
																	Needs Sponsor - {group.phase}
																</SelectLabel>
																{group.items.map((competition) => (
																	<SelectItem
																		key={competition.id}
																		value={competition.id}
																	>
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
																		<SelectItem
																			key={competition.id}
																			value={competition.id}
																		>
																			{competition.name} (
																			{competition.compStart})
																		</SelectItem>
																	))}
																</SelectGroup>
															</>
														) : null}
													</SelectContent>
												</Select>
												{selectedCompetition ? (
													<div className="space-y-2 rounded-md border p-3">
														<p className="text-xs text-muted-foreground">
															Phase: {selectedCompetition.currentPhaseName} ·
															Sponsor status:{" "}
															{sponsorPropertyStatusLabel(
																selectedCompetition.sponsorPropertyStatus,
															)}
														</p>
														<p className="text-sm font-medium">
															{selectedCompetition.name}
														</p>
														<p className="text-xs text-muted-foreground">
															Dates: {selectedCompetition.compStart} -{" "}
															{selectedCompetition.compEnd}
														</p>
														<p className="text-xs text-muted-foreground">
															{selectedCompetition.wcaCompetitionId
																? "WCA link present. Full competition details will sync after draft creation."
																: "No WCA link yet. Full competition details cannot sync until linked."}
														</p>
													</div>
												) : null}
											</div>

											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<p className="text-xs text-muted-foreground">
														Auction type
													</p>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="size-7"
														onClick={() =>
															setIsCreateFrameworkUnlocked(
																(current) => !current,
															)
														}
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
														if (!isSponsorshipFramework(value)) return;
														setCreateFramework(value);
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

											<div className="grid gap-3 md:grid-cols-2">
												<div className="space-y-2">
													<p className="text-xs text-muted-foreground">
														Start price (EUR)
													</p>
													<Input
														type="number"
														min="1"
														step="0.01"
														value={createStartPriceEuros}
														onChange={(event) =>
															setCreateStartPriceEuros(event.target.value)
														}
														required
													/>
												</div>
												<div className="space-y-2">
													<p className="text-xs text-muted-foreground">
														Starts at
													</p>
													<Input
														type="datetime-local"
														value={createStartsAtInput}
														onChange={(event) =>
															setCreateStartsAtInput(event.target.value)
														}
														required
													/>
												</div>
												<div className="space-y-2">
													<p className="text-xs text-muted-foreground">
														Ends at
													</p>
													<Input
														type="datetime-local"
														value={createEndsAtInput}
														onChange={(event) =>
															setCreateEndsAtInput(event.target.value)
														}
														required
													/>
												</div>
											</div>

											<div className="space-y-2">
												<p className="text-xs text-muted-foreground">
													Invited sponsors
												</p>
												<div className="grid gap-2 md:grid-cols-2">
													{activeSponsors.map((sponsor) => (
														<div
															key={sponsor.id}
															className="flex items-center gap-2 rounded border px-2 py-1.5"
														>
															<Checkbox
																checked={createInvitedSponsorIds.includes(
																	sponsor.id,
																)}
																onCheckedChange={() =>
																	toggleCreateSponsorInvite(sponsor.id)
																}
															/>
															<span className="text-sm">{sponsor.name}</span>
														</div>
													))}
												</div>
											</div>

											<Button type="submit" disabled={isCreatingAuction}>
												{isCreatingAuction ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													"Create draft"
												)}
											</Button>
										</form>
									) : !selectedAuction ? (
										<p className="text-sm text-muted-foreground">
											Select an auction from the table.
										</p>
									) : isLoadingManagerView || managerView === null ? (
										<div className="flex items-center justify-center py-6">
											<Loader2 className="size-5 animate-spin text-muted-foreground" />
										</div>
									) : (
										<div className="space-y-4">
											<div className="space-y-1 rounded-md border p-3 text-sm">
												<p className="font-medium">
													{selectedAuction.competitionName}
												</p>
												<p className="text-xs text-muted-foreground">
													{sponsorshipFrameworkLabel(selectedAuction.framework)}{" "}
													· {selectedAuction.competitionPhaseName}
												</p>
												<div className="mt-2 flex flex-wrap items-center gap-2">
													<Badge
														variant={sponsorshipStateBadgeVariant(
															selectedAuction.state,
														)}
													>
														{sponsorshipStateLabel(selectedAuction.state)}
													</Badge>
													<Badge variant="outline">
														Bid intents: {managerView.intentCount}
													</Badge>
													<Badge variant="outline">
														Bid events: {managerView.eventCount}
													</Badge>
												</div>
											</div>
											<div className="space-y-2 rounded-md border p-3 text-sm">
												<div className="flex flex-wrap items-center justify-between gap-2">
													<p className="text-xs text-muted-foreground">
														Competition data status
													</p>
													<Badge
														variant={
															isSelectedAuctionCompetitionSummaryReady
																? "default"
																: "secondary"
														}
													>
														{isSelectedAuctionCompetitionSummaryReady
															? "Synced from WCA"
															: "Needs WCA sync"}
													</Badge>
												</div>
												{selectedAuctionCompetitionSummary ? (
													<>
														<p className="font-medium">
															{selectedAuctionCompetitionSummary.name}
														</p>
														<p className="text-xs text-muted-foreground">
															Dates:{" "}
															{formatCompetitionSummaryDateRange(
																selectedAuctionCompetitionSummary,
															)}
														</p>
														<p className="text-xs text-muted-foreground">
															Competitor limit:{" "}
															{selectedAuctionCompetitionSummary.competitorLimit !==
															undefined
																? `${selectedAuctionCompetitionSummary.competitorLimit}`
																: "Not set"}
														</p>
													</>
												) : null}
												<p className="text-xs text-muted-foreground">
													{selectedAuctionCompetitionSummaryFetchedAt
														? `Last synced: ${formatDateTime(selectedAuctionCompetitionSummaryFetchedAt)}`
														: "Last synced: not yet"}
												</p>
												<Button
													type="button"
													variant="outline"
													size="sm"
													disabled={refreshingAuctionId === selectedAuction.id}
													onClick={() =>
														void onRefreshAuctionCompetitionData(
															selectedAuction.id,
														)
													}
												>
													{refreshingAuctionId === selectedAuction.id ? (
														<Loader2 className="size-4 animate-spin" />
													) : (
														<RefreshCw className="size-4" />
													)}
													Refresh competition data
												</Button>
											</div>

											<form
												className="space-y-3"
												onSubmit={onSaveAuctionChanges}
											>
												<div className="space-y-2">
													<div className="flex items-center justify-between">
														<p className="text-xs text-muted-foreground">
															Auction type
														</p>
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="size-7"
															onClick={() =>
																setIsEditFrameworkUnlocked(
																	(current) => !current,
																)
															}
														>
															{isEditFrameworkUnlocked ? (
																<LockOpen className="size-3.5" />
															) : (
																<Lock className="size-3.5" />
															)}
															<span className="sr-only">
																{isEditFrameworkUnlocked
																	? "Lock auction type"
																	: "Unlock auction type"}
															</span>
														</Button>
													</div>
													<Select
														value={editFramework}
														onValueChange={(value) => {
															if (!isSponsorshipFramework(value)) return;
															setEditFramework(value);
														}}
														disabled={!isEditFrameworkUnlocked}
													>
														<SelectTrigger className="w-full">
															<SelectValue placeholder="Select auction type">
																{sponsorshipFrameworkLabel(editFramework)}
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

												<div className="grid gap-3 md:grid-cols-2">
													<div className="space-y-2">
														<p className="text-xs text-muted-foreground">
															Starts at
														</p>
														<Input
															type="datetime-local"
															value={editStartsAtInput}
															onChange={(event) =>
																setEditStartsAtInput(event.target.value)
															}
															required
														/>
													</div>
													<div className="space-y-2">
														<p className="text-xs text-muted-foreground">
															Ends at
														</p>
														<Input
															type="datetime-local"
															value={editEndsAtInput}
															onChange={(event) =>
																setEditEndsAtInput(event.target.value)
															}
															required
														/>
													</div>
													<div className="space-y-2">
														<p className="text-xs text-muted-foreground">
															Start price (EUR)
														</p>
														<Input
															type="number"
															min="1"
															step="0.01"
															value={editStartPriceEuros}
															onChange={(event) =>
																setEditStartPriceEuros(event.target.value)
															}
															required
														/>
													</div>
												</div>

												<div className="space-y-2">
													<p className="text-xs text-muted-foreground">
														Invited sponsors
													</p>
													<div className="grid gap-2 md:grid-cols-2">
														{activeSponsors.map((sponsor) => (
															<div
																key={`edit-${sponsor.id}`}
																className="flex items-center gap-2 rounded border px-2 py-1.5"
															>
																<Checkbox
																	checked={editInvitedSponsorIds.includes(
																		sponsor.id,
																	)}
																	onCheckedChange={() =>
																		toggleEditSponsorInvite(sponsor.id)
																	}
																/>
																<span className="text-sm">{sponsor.name}</span>
															</div>
														))}
													</div>
												</div>

												<Button
													type="submit"
													variant="outline"
													disabled={
														isSavingAuction ||
														selectedAuction.state === "active" ||
														selectedAuction.state === "closed"
													}
												>
													{isSavingAuction ? (
														<Loader2 className="size-4 animate-spin" />
													) : (
														"Save changes"
													)}
												</Button>
												{hasPendingEditChanges ? (
													<p className="text-xs text-muted-foreground">
														You have unsaved changes.
													</p>
												) : null}
											</form>

											<div className="flex flex-wrap gap-2">
												{selectedAuction.state === "draft" ||
												selectedAuction.state === "scheduled" ? (
													<Button
														size="sm"
														disabled={
															busyAuctionId === selectedAuction.id ||
															hasPendingEditChanges ||
															refreshingAuctionId === selectedAuction.id
														}
														onClick={() =>
															void onStartAuction(selectedAuction.id)
														}
													>
														Start auction
													</Button>
												) : null}
												{selectedAuction.state !== "closed" ? (
													<Button
														size="sm"
														variant="outline"
														disabled={
															busyAuctionId === selectedAuction.id ||
															hasPendingEditChanges
														}
														onClick={() =>
															void onCloseAuction(selectedAuction.id)
														}
													>
														Close auction
													</Button>
												) : null}
												{selectedAuction.state === "draft" ||
												selectedAuction.state === "scheduled" ? (
													<Button
														size="sm"
														variant="destructive"
														disabled={busyAuctionId === selectedAuction.id}
														onClick={() =>
															void onDeleteBeforeOpen(selectedAuction.id)
														}
													>
														<Trash2 className="size-4" />
														Delete before open
													</Button>
												) : null}
											</div>
											{selectedAuction.state !== "draft" &&
											selectedAuction.state !== "scheduled" ? (
												<>
													<Separator />
													<AuctionBidStatusSection
														intentCount={managerView.intentCount}
														eventCount={managerView.eventCount}
														outcomes={selectedOpenAuctionSponsorOutcomes}
														flatBreakdown
													/>
												</>
											) : null}
										</div>
									)}
									<Separator />
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<p className="text-xs text-muted-foreground">
												Previous closed auctions for this competition
											</p>
											{panelCompetitionId ? (
												<Badge variant="outline">
													{previousClosedAuctionsForPanel.length}
												</Badge>
											) : null}
										</div>
										{panelCompetitionId === null ? (
											<p className="text-sm text-muted-foreground">
												Select a competition to view historical outcomes.
											</p>
										) : previousClosedAuctionsForPanel.length === 0 ? (
											<p className="text-sm text-muted-foreground">
												No previous closed auctions for this competition.
											</p>
										) : (
											<div className="space-y-2">
												{previousClosedAuctionsForPanel.map((auction) => {
													const winningBidCents =
														auction.settlementAmountCents ??
														auction.currentPriceCents ??
														auction.startPriceCents;
													const winnerName = auction.winnerSponsorId
														? (sponsorById.get(auction.winnerSponsorId)?.name ??
															"Unknown sponsor")
														: "No winner";
													return (
														<div
															key={`history-${auction.id}`}
															className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
														>
															<div className="space-y-1">
																<p className="font-medium">
																	{formatDateTime(auction.endsAt)}
																</p>
																<p className="text-xs text-muted-foreground">
																	{sponsorshipFrameworkLabel(auction.framework)}{" "}
																	· {winnerName}
																</p>
																<p className="text-xs text-muted-foreground">
																	Winning bid:{" "}
																	{formatEuroFromCents(winningBidCents)}
																</p>
															</div>
															<Button
																size="sm"
																variant="outline"
																onClick={() => {
																	setSelectedClosedAuctionId(auction.id);
																	setActiveTab("closed");
																}}
															>
																View
															</Button>
														</div>
													);
												})}
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent value="closed" className="space-y-4">
						<div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
							<Card>
								<CardHeader>
									<CardTitle>Closed Auctions</CardTitle>
									<CardDescription>
										Historical auctions and winning bids.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									<Input
										placeholder="Search competitions or phases"
										value={closedSearchQuery}
										onChange={(event) =>
											setClosedSearchQuery(event.target.value)
										}
										className="max-w-sm"
									/>
									{renderAuctionTable({
										rows: filteredClosedAuctions,
										emptyText: "No closed auctions.",
										selectedId: selectedClosedAuctionId,
										actionLabel: "View",
										onSelect: (auctionId) =>
											setSelectedClosedAuctionId(auctionId),
									})}
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Auction Outcome</CardTitle>
									<CardDescription>
										Review winner and final amount for previous auctions.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									{selectedClosedAuction === null ? (
										<p className="text-sm text-muted-foreground">
											Select a closed auction from the table.
										</p>
									) : (
										<>
											<div className="space-y-1 rounded-md border p-3 text-sm">
												<p className="font-medium">
													{selectedClosedAuction.competitionName}
												</p>
												<p className="text-xs text-muted-foreground">
													{sponsorshipFrameworkLabel(
														selectedClosedAuction.framework,
													)}{" "}
													· {selectedClosedAuction.competitionPhaseName}
												</p>
												<div className="mt-2 flex flex-wrap items-center gap-2">
													<Badge
														variant={sponsorshipStateBadgeVariant(
															selectedClosedAuction.state,
														)}
													>
														{sponsorshipStateLabel(selectedClosedAuction.state)}
													</Badge>
													<Badge variant="outline">
														Closed{" "}
														{formatDateTime(selectedClosedAuction.endsAt)}
													</Badge>
												</div>
											</div>
											<div className="space-y-2 rounded-md border p-3 text-sm">
												<div className="flex items-center justify-between gap-2">
													<span className="text-muted-foreground">Winner</span>
													<span className="font-medium">
														{selectedClosedAuctionWinnerName}
													</span>
												</div>
												<div className="flex items-center justify-between gap-2">
													<span className="text-muted-foreground">
														Winning bid
													</span>
													<span className="font-medium tabular-nums">
														{formatEuroFromCents(
															selectedClosedAuctionWinningBidCents ??
																selectedClosedAuction.startPriceCents,
														)}
													</span>
												</div>
												<div className="flex items-center justify-between gap-2">
													<span className="text-muted-foreground">
														Start price
													</span>
													<span className="font-medium tabular-nums">
														{formatEuroFromCents(
															selectedClosedAuction.startPriceCents,
														)}
													</span>
												</div>
												<div className="flex items-center justify-between gap-2">
													<span className="text-muted-foreground">Started</span>
													<span className="font-medium">
														{formatDateTime(selectedClosedAuction.startsAt)}
													</span>
												</div>
												<div className="flex items-center justify-between gap-2">
													<span className="text-muted-foreground">Closed</span>
													<span className="font-medium">
														{formatDateTime(selectedClosedAuction.endsAt)}
													</span>
												</div>
												<div className="flex items-center justify-between gap-2">
													<span className="text-muted-foreground">
														Last updated
													</span>
													<span className="font-medium">
														{formatDateTime(selectedClosedAuction.updatedAt)}
													</span>
												</div>
											</div>
											{isLoadingClosedAuctionManagerView ? (
												<div className="flex items-center justify-center py-4">
													<Loader2 className="size-4 animate-spin text-muted-foreground" />
												</div>
											) : closedAuctionManagerView ? (
												<AuctionBidStatusSection
													intentCount={closedAuctionManagerView.intentCount}
													eventCount={closedAuctionManagerView.eventCount}
													invitedSponsors={selectedClosedAuctionInvitedSponsors}
													outcomes={selectedClosedAuctionSponsorOutcomes}
												/>
											) : null}
										</>
									)}
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent value="sponsors" className="space-y-4">
						<div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
							<Card>
								<CardHeader>
									<CardTitle>Create Sponsor</CardTitle>
									<CardDescription>
										Create sponsor accounts to invite to auctions.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<form className="grid gap-3" onSubmit={onCreateSponsor}>
										<Input
											placeholder="Sponsor name"
											value={name}
											onChange={(event) => setName(event.target.value)}
											required
											disabled={isSubmittingSponsor}
										/>
										<Input
											type="email"
											placeholder="sponsor@example.com"
											value={email}
											onChange={(event) => setEmail(event.target.value)}
											required
											disabled={isSubmittingSponsor}
										/>
										<Input
											placeholder="Avatar URL (optional)"
											value={avatarUrl}
											onChange={(event) => setAvatarUrl(event.target.value)}
											disabled={isSubmittingSponsor}
										/>
										<Button type="submit" disabled={isSubmittingSponsor}>
											{isSubmittingSponsor ? (
												<Loader2 className="size-4 animate-spin" />
											) : (
												"Create sponsor"
											)}
										</Button>
									</form>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Sponsor Security and Access</CardTitle>
									<CardDescription>
										Manage sign-in access, session revocation, and account
										status.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									{isLoadingSponsors ? (
										<div className="flex items-center justify-center py-8">
											<Loader2 className="size-5 animate-spin text-muted-foreground" />
										</div>
									) : sponsors.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											No sponsors yet.
										</p>
									) : (
										sponsors.map((sponsor) => (
											<div
												key={sponsor.id}
												className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
											>
												<div className="min-w-0 space-y-1">
													<p className="truncate font-medium">{sponsor.name}</p>
													<p className="truncate text-xs text-muted-foreground">
														{sponsor.email}
													</p>
													<div className="flex flex-wrap gap-1.5">
														<Badge
															variant={sponsor.active ? "secondary" : "outline"}
														>
															{sponsor.active ? "Active" : "Inactive"}
														</Badge>
														<Badge variant="outline">
															{sponsor.hasAuthAccount
																? "Portal access ready"
																: "Portal access not set up"}
														</Badge>
														{sponsor.lastAccessEmailSentAt ? (
															<Badge variant="outline">
																Access email{" "}
																{formatDateTime(sponsor.lastAccessEmailSentAt)}
															</Badge>
														) : null}
													</div>
												</div>
												<div className="flex flex-wrap gap-2">
													<Button
														size="sm"
														variant="outline"
														disabled={
															busySponsorId === sponsor.id || !sponsor.active
														}
														onClick={() => void onSendAccessEmail(sponsor.id)}
													>
														<Send className="size-3.5" />
														Send access email
													</Button>
													<Button
														size="sm"
														variant="outline"
														disabled={busySponsorId === sponsor.id}
														onClick={() => void onResetSessions(sponsor.id)}
													>
														<ShieldX className="size-3.5" />
														Revoke sessions
													</Button>
													{sponsor.active ? (
														<Button
															size="sm"
															variant="destructive"
															disabled={busySponsorId === sponsor.id}
															onClick={() => void onArchiveSponsor(sponsor.id)}
														>
															Archive
														</Button>
													) : (
														<Button
															size="sm"
															variant="outline"
															disabled={busySponsorId === sponsor.id}
															onClick={() =>
																void onUnarchiveSponsor(sponsor.id)
															}
														>
															Unarchive
														</Button>
													)}
												</div>
											</div>
										))
									)}
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent value="auctionTypes" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Auction Types</CardTitle>
								<CardDescription>
									Each auction uses one of these formats.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<AuctionBiddingHelpOverview />
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>

				{isLoadingCompetitions ? (
					<p className="text-xs text-muted-foreground">Loading competitions…</p>
				) : null}
			</div>
		</div>
	);
}
