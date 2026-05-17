import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { glass } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { useAction } from "convex/react";
import { toast } from "sonner";
import {
	AlertTriangle,
	ArrowLeft,
	Bell,
	CalendarDays,
	CheckIcon,
	Circle,
	ExternalLink,
	FileSpreadsheet,
	Gavel,
	Globe,
	Loader2,
	MessageSquare,
	MoreHorizontal,
	Search,
	Store,
	Trash2,
	Users,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { CompetitionLatestUpdate } from "@/components/competitions/competition-latest-update";
import { CompetitionTasksByPhase } from "@/components/competitions/competition-tasks-by-phase";
import { CompetitionPhaseStatusList } from "@/components/competitions/competition-phase-status-list";
import {
	EditableCompLeadCell,
	EditableLeadDelegateCell,
	EditableOrganisersCell,
	EditablePhaseCell,
} from "@/components/competitions/editable-phase-and-roles";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { TitleDescriptionEditModal } from "@/components/shared/title-description-edit-modal";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { requireCompetitionId } from "@/lib/convex-ids";
import { isFinishedTask } from "@/lib/competition-phase-task-view";
import { formatDate, formatDateShort } from "@/lib/format-utils";
import {
	useCompetition,
	useNotificationMutations,
	useNotificationSubscriptions,
	useTasksForCompetition,
	useCompetitionMutations,
	useIsSponsorshipManager,
	useSponsors,
	useDiscordActions,
} from "@/hooks/use-convex-data";
import type { Competition, Task } from "@/data/types-new";
import { onMutationError } from "@/lib/utils";

export const Route = createFileRoute("/competitions/$id")({
	component: RouteComponent,
});

const COMPETITION_AVATAR_SIZE = 48;

type WcaSearchResult = {
	id: string;
	name: string;
	city: string;
	country_iso2: string;
	start_date: string;
	end_date: string;
	event_ids: string[];
};

function parseGoogleSheetId(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
	if (urlMatch) return urlMatch[1];
	if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
	return null;
}

function sponsorStatusLabel(competition: Competition): string {
	switch (competition.sponsorPropertyStatus) {
		case "not_offered":
			return "Not Offered";
		case "bidding":
			return "Bidding";
		case "none":
			return "None";
		case "sponsor":
			return competition.sponsorPropertyDisplay ?? "Sponsor";
		default:
			return "None";
	}
}

function sponsorStatusBadgeVariant(
	status: Competition["sponsorPropertyStatus"],
): "secondary" | "outline" | "destructive" | "default" {
	switch (status) {
		case "not_offered":
			return "outline";
		case "bidding":
			return "secondary";
		case "none":
			return "destructive";
		case "sponsor":
			return "default";
		default:
			return "outline";
	}
}

function formatWinningBid(cents: number): string {
	return `€${(cents / 100).toFixed(2)}`;
}

function auctionDerivedSponsorLabel(competition: Competition): string {
	if (competition.auctionDerivedSponsorPropertyStatus === "sponsor") {
		return competition.auctionDerivedSponsorPropertyDisplay ?? "Sponsor";
	}
	switch (competition.auctionDerivedSponsorPropertyStatus) {
		case "bidding":
			return "Bidding in progress";
		case "none":
			return "No sponsor";
		default:
			return "Not offered";
	}
}

function PropertyField({
	label,
	icon,
	children,
}: {
	label: string;
	icon?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-2 py-1.5">
			<span className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
				{icon}
				{label}
			</span>
			<div className="min-w-0">{children}</div>
		</div>
	);
}

function CompetitionHeader({ competition }: { competition: Competition }) {
	return (
		<PageHeader.Root withBottomBorder={false}>
			<SidebarTrigger className="shrink-0" />
			<PageHeader.Divider />
			<Link
				to="/competitions"
				className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				<span className="text-sm hidden sm:inline">Back to Competitions</span>
			</Link>
			<PageHeader.Divider className="mx-2" />
			<h1 className="max-w-45 truncate text-sm font-semibold sm:max-w-75">
				{competition.name}
			</h1>
		</PageHeader.Root>
	);
}

function RouteComponent() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const competitionId = requireCompetitionId(id);
	const competition = useCompetition(competitionId);
	const { tasks: scopedTasks } = useTasksForCompetition(competitionId);
	const { subscriptions } = useNotificationSubscriptions();
	const { subscribeToCompetition, unsubscribeFromCompetition } =
		useNotificationMutations();
	const { updateCompetition, deleteCompetition } = useCompetitionMutations();
	const {
		isManager: isSponsorshipManager,
		isLoading: isSponsorshipAccessLoading,
	} = useIsSponsorshipManager();
	const { sponsors } = useSponsors(isSponsorshipManager);

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [detailsModalOpen, setDetailsModalOpen] = useState(false);
	const [detailsModalFocusField, setDetailsModalFocusField] = useState<
		"title" | "description"
	>("title");
	const [dateRange, setDateRange] = useState<DateRange | undefined>(
		competition
			? {
					from: new Date(competition.compStart),
					to: new Date(competition.compEnd),
				}
			: undefined,
	);
	const dateRangeRef = useRef(dateRange);
	dateRangeRef.current = dateRange;
	const [sheetInput, setSheetInput] = useState("");
	const [sheetPopoverOpen, setSheetPopoverOpen] = useState(false);
	const [wcaSearchQuery, setWcaSearchQuery] = useState("");
	const [wcaSearchResults, setWcaSearchResults] = useState<WcaSearchResult[]>(
		[],
	);
	const [wcaMyComps, setWcaMyComps] = useState<WcaSearchResult[]>([]);
	const [wcaMyCompsLoaded, setWcaMyCompsLoaded] = useState(false);
	const [wcaSearching, setWcaSearching] = useState(false);
	const [wcaPopoverOpen, setWcaPopoverOpen] = useState(false);
	const [wcaLinking, setWcaLinking] = useState<string | null>(null);
	const [wcaSearchAll, setWcaSearchAll] = useState(false);
	const [discordPopoverOpen, setDiscordPopoverOpen] = useState(false);
	const [discordChannelsLoading, setDiscordChannelsLoading] = useState(false);
	const [discordChannels, setDiscordChannels] = useState<
		Array<{
			guildId: string;
			id: string;
			name: string;
			type: number;
			position: number;
			parentId?: string;
		}>
	>([]);

	const searchWcaCompetitions = useAction(
		api.integrations.wca.actions.searchCompetitions,
	);
	const fetchMyWcaCompetitions = useAction(
		api.integrations.wca.actions.fetchMyCompetitions,
	);
	const { listGuildChannels } = useDiscordActions();

	const isSubscribed = subscriptions.some(
		(subscription) =>
			subscription.entityType === "competition" &&
			subscription.entityId === competitionId,
	);

	const handleToggleSubscription = () => {
		if (isSubscribed) {
			void unsubscribeFromCompetition(competitionId).catch(onMutationError);
			return;
		}
		void subscribeToCompetition(competitionId).catch(onMutationError);
	};

	const handleDelete = async () => {
		setDeleteDialogOpen(false);
		try {
			await deleteCompetition(competitionId);
			void navigate({ to: "/competitions" });
		} catch (error) {
			onMutationError(error);
		}
	};

	const sponsorOverrideValue = competition?.manualSponsorId
		? `sponsor:${competition.manualSponsorId}`
		: competition?.manualSponsorPropertyStatus === "none"
			? "none"
			: "auto";

	const activeSponsors = useMemo(
		() => sponsors.filter((sponsor) => sponsor.active),
		[sponsors],
	);

	const sponsorOptions = useMemo(() => {
		if (!competition) return [];
		const byId = new Map(
			activeSponsors.map((sponsor) => [sponsor.id, sponsor]),
		);
		if (competition.manualSponsorId && !byId.has(competition.manualSponsorId)) {
			const currentManualSponsor = sponsors.find(
				(sponsor) => sponsor.id === competition.manualSponsorId,
			);
			if (currentManualSponsor) {
				byId.set(currentManualSponsor.id, currentManualSponsor);
			}
		}
		return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
	}, [activeSponsors, competition?.manualSponsorId, sponsors, competition]);

	const hasManualSponsorOverride = competition
		? competition.manualSponsorPropertyStatus !== undefined ||
			competition.manualSponsorId !== undefined
		: false;

	const derivedSponsorOverrideValue = competition
		? competition.auctionDerivedSponsorPropertyStatus === "sponsor" &&
			competition.auctionDerivedSponsorId
			? `sponsor:${competition.auctionDerivedSponsorId}`
			: competition.auctionDerivedSponsorPropertyStatus === "none"
				? "none"
				: "auto"
		: "auto";

	const handleSponsorOverrideChange = useCallback(
		(nextValue: string) => {
			if (!isSponsorshipManager || !competition) return;
			const mismatch =
				nextValue !== "auto" && nextValue !== derivedSponsorOverrideValue;
			if (mismatch) {
				const shouldApplyOverride = window.confirm(
					`Auction status currently suggests "${auctionDerivedSponsorLabel(competition)}". Apply manual sponsor override anyway?`,
				);
				if (!shouldApplyOverride) return;
			}
			if (nextValue === "auto") {
				void updateCompetition(competition.id, {
					sponsorPropertyStatusOverride: null,
					sponsorOverrideSponsorId: null,
				}).catch(onMutationError);
				return;
			}
			if (nextValue === "none") {
				void updateCompetition(competition.id, {
					sponsorPropertyStatusOverride: "none",
					sponsorOverrideSponsorId: null,
				}).catch(onMutationError);
				return;
			}
			const sponsorId = nextValue.replace("sponsor:", "") as Id<"sponsors">;
			void updateCompetition(competition.id, {
				sponsorPropertyStatusOverride: "sponsor",
				sponsorOverrideSponsorId: sponsorId,
			}).catch(onMutationError);
		},
		[
			competition,
			derivedSponsorOverrideValue,
			isSponsorshipManager,
			updateCompetition,
		],
	);

	const handleSetDateRange = useCallback(
		(range: { from?: Date; to?: Date }) => {
			if (!competition) return;
			const from = range.from?.toISOString().split("T")[0];
			const to = range.to?.toISOString().split("T")[0];
			if (!from && !to) return;
			void updateCompetition(competition.id, {
				compStart: from ?? competition.compStart,
				compEnd: to ?? competition.compEnd,
			}).catch(onMutationError);
		},
		[competition, updateCompetition],
	);

	const openDetailsModal = (focusField: "title" | "description") => {
		setDetailsModalFocusField(focusField);
		setDetailsModalOpen(true);
	};

	const handleSaveDetails = async (values: {
		title: string;
		description: string;
	}) => {
		if (!competition) return;
		const updates: Partial<{
			name: string;
			description: string;
		}> = {};
		if (values.title !== competition.name) {
			updates.name = values.title;
		}
		if (values.description !== competition.description) {
			updates.description = values.description;
		}
		if (Object.keys(updates).length === 0) return;
		await updateCompetition(competition.id, updates).catch((error) => {
			onMutationError(error);
			throw error;
		});
	};

	if (competition === undefined) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (competition === null) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center">
					<h2 className="text-lg font-medium">Competition not found</h2>
					<p className="text-muted-foreground">
						The competition you&apos;re looking for doesn&apos;t exist.
					</p>
					<Link to="/competitions">
						<Button className="mt-4">Back to Competitions</Button>
					</Link>
				</div>
			</div>
		);
	}

	const competitionWithTasks: Competition & { tasks: Task[] } = {
		...competition,
		tasks: scopedTasks,
	};

	const total = scopedTasks.length;
	const done = scopedTasks.filter((task) => task.status === "done").length;
	const inProgress = scopedTasks.filter(
		(task) => task.status === "in-progress",
	).length;
	const blocked = scopedTasks.filter(
		(task) => task.isBlocked && task.unresolvedBlockerCount > 0,
	).length;

	const currentPhase = competition.phases[competition.currentPhaseIdx];
	const currentPhaseId = currentPhase?.id;
	const currentPhaseTasks = currentPhaseId
		? scopedTasks.filter((task) => task.phase?.id === currentPhaseId)
		: scopedTasks;
	const currentPhaseCompleted = currentPhaseTasks.filter(isFinishedTask).length;
	const phaseTaskCount = currentPhaseTasks.length;
	const completionPercent =
		currentPhaseTasks.length === 0
			? 0
			: Math.round((currentPhaseCompleted / currentPhaseTasks.length) * 100);

	const avatarDataUri = createAvatar(glass, {
		seed: competition.name,
		size: COMPETITION_AVATAR_SIZE,
	}).toDataUri();

	const SponsorStatusIcon = hasManualSponsorOverride
		? AlertTriangle
		: competition.sponsorPropertyStatus === "sponsor"
			? Gavel
			: null;
	const sponsorStatusText = sponsorStatusLabel(competition);
	const sponsorStatusTooltip = hasManualSponsorOverride
		? "Manual sponsor override"
		: competition.sponsorPropertyStatus === "sponsor"
			? "Winning bid from auction"
			: null;
	const sponsorStatusBadge = (
		<Badge
			variant={sponsorStatusBadgeVariant(competition.sponsorPropertyStatus)}
		>
			{SponsorStatusIcon ? (
				<SponsorStatusIcon className="size-3.5 mr-1" />
			) : null}
			{sponsorStatusText}
		</Badge>
	);
	const sponsorStatusBadgeWithTooltip = sponsorStatusTooltip ? (
		<Tooltip>
			<TooltipTrigger asChild>{sponsorStatusBadge}</TooltipTrigger>
			<TooltipContent side="top" sideOffset={6}>
				{sponsorStatusTooltip}
			</TooltipContent>
		</Tooltip>
	) : (
		sponsorStatusBadge
	);

	return (
		<div className="flex h-full flex-col overflow-x-hidden">
			<CompetitionHeader competition={competitionWithTasks} />
			<div className="flex-1 overflow-auto px-3 pb-4 pt-0 sm:px-4 sm:pb-5 sm:pt-0 lg:px-6 lg:pb-6 lg:pt-0">
				<div className="mx-auto w-full max-w-3xl space-y-4 pb-10 sm:space-y-5">
					<section className="rounded-xl border border-border/70 bg-card">
						<div className="px-4 py-4 sm:px-5 sm:py-5 border-b border-border/50">
							<div className="flex items-start gap-4">
								<img
									src={avatarDataUri}
									alt=""
									className="size-12 shrink-0 rounded-lg border border-border object-cover"
								/>
								<div className="flex-1 min-w-0">
									<button
										type="button"
										className="text-left text-xl font-semibold tracking-tight text-balance hover:bg-muted/60 -mx-1 rounded px-1 sm:text-2xl"
										onClick={() => openDetailsModal("title")}
									>
										{competition.name}
									</button>
									<div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-muted-foreground">
										<Popover
											onOpenChange={(open) => {
												if (open && competition) {
													setDateRange({
														from: new Date(competition.compStart),
														to: new Date(competition.compEnd),
													});
												} else if (!open) {
													const range = dateRangeRef.current;
													if (range?.from && range?.to) {
														handleSetDateRange(range);
													}
												}
											}}
										>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													className="justify-start gap-1.5 px-2.5 font-normal"
												>
													<CalendarDays className="size-3" />
													{dateRange?.from ? (
														dateRange.to ? (
															<>
																{formatDateShort(dateRange.from)} –{" "}
																{formatDateShort(dateRange.to)}
															</>
														) : (
															formatDateShort(dateRange.from)
														)
													) : (
														<span>Pick a date</span>
													)}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="start">
												<Calendar
													mode="range"
													defaultMonth={dateRange?.from}
													selected={dateRange}
													onSelect={(range) => {
														if (range?.to && !range.from) {
															setDateRange({
																from: range.to,
																to: undefined,
															});
														} else {
															setDateRange(range);
														}
													}}
													numberOfMonths={2}
												/>
											</PopoverContent>
										</Popover>
										{currentPhase && (
											<>
												<span className="text-muted-foreground/50">·</span>
												<Badge
													variant="outline"
													className="gap-1 border-border bg-background text-[11px] font-normal"
												>
													<span className="size-1.5 rounded-full bg-chart-1" />
													{currentPhase.name}
												</Badge>
											</>
										)}
									</div>
								</div>
							</div>
						</div>

						<div className="px-4 py-3 sm:px-5 border-b border-border/50">
							<div className="text-xs text-muted-foreground mb-1">
								Description
							</div>
							<button
								type="button"
								className="w-full text-left text-sm text-muted-foreground hover:bg-muted/60 -mx-1 rounded px-1"
								onClick={() => openDetailsModal("description")}
							>
								{competition.description || "Click to add a description..."}
							</button>
						</div>

						<div className="px-4 py-3 sm:px-5">
							<div className="flex items-center justify-between gap-2 text-xs mb-2">
								<span className="text-muted-foreground">
									Phase: {phaseTaskCount} tasks
								</span>
								<span className="font-medium">
									{completionPercent}% complete
								</span>
							</div>
							<div className="h-2 rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-success transition-[width]"
									style={{ width: `${completionPercent}%` }}
								/>
							</div>
							<div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
								<span>
									<span className="text-foreground font-medium">{done}</span>{" "}
									done
								</span>
								<span>
									<span className="text-foreground font-medium">
										{inProgress}
									</span>{" "}
									in progress
								</span>
								<span>
									<span className="text-foreground font-medium">{total}</span>{" "}
									total
								</span>
								{blocked > 0 && (
									<span className="text-destructive">
										<span className="font-medium">{blocked}</span> blocked
									</span>
								)}
							</div>
						</div>
						<div className="flex items-center gap-2 border-t border-border/50 px-4 py-3 sm:px-5">
							<Button
								variant={isSubscribed ? "secondary" : "outline"}
								size="sm"
								onClick={handleToggleSubscription}
								className="gap-1.5"
							>
								<Bell className="size-4" />
								{isSubscribed ? "Watching" : "Watch"}
							</Button>
						</div>
					</section>

					<div className="grid gap-4 md:grid-cols-2">
						<section className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5 sm:py-5">
							<h3 className="text-sm font-semibold mb-3">Properties</h3>
							<div className="space-y-1">
								<PropertyField
									label="Phase"
									icon={<Circle className="size-3.5" />}
								>
									<EditablePhaseCell competition={competition} />
								</PropertyField>
								<PropertyField
									label="Sponsor"
									icon={<Store className="size-3.5" />}
								>
									{isSponsorshipAccessLoading ? (
										<span className="text-xs text-muted-foreground">
											Checking permissions...
										</span>
									) : isSponsorshipManager ? (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 min-w-0 max-w-full px-2 justify-start"
												>
													{sponsorStatusBadgeWithTooltip}
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent className="w-64 p-0" align="end">
												<Command>
													<CommandList>
														<CommandEmpty>
															No sponsor options available.
														</CommandEmpty>
														<CommandGroup>
															<CommandItem
																value="auto"
																onSelect={() =>
																	handleSponsorOverrideChange("auto")
																}
																className="flex items-center justify-between"
															>
																<span className="text-xs">
																	Follow auction outcome
																</span>
																{sponsorOverrideValue === "auto" ? (
																	<CheckIcon size={14} className="ml-auto" />
																) : null}
															</CommandItem>
															<CommandItem
																value="none"
																onSelect={() =>
																	handleSponsorOverrideChange("none")
																}
																className="flex items-center justify-between"
															>
																<span className="text-xs">
																	No sponsor (override)
																</span>
																{sponsorOverrideValue === "none" ? (
																	<CheckIcon size={14} className="ml-auto" />
																) : null}
															</CommandItem>
															{sponsorOptions.map((sponsor) => {
																const value = `sponsor:${sponsor.id}`;
																return (
																	<CommandItem
																		key={sponsor.id}
																		value={sponsor.name}
																		onSelect={() =>
																			handleSponsorOverrideChange(value)
																		}
																		className="flex items-center justify-between"
																	>
																		<span className="text-xs">
																			{sponsor.name} (override)
																		</span>
																		{sponsorOverrideValue === value ? (
																			<CheckIcon
																				size={14}
																				className="ml-auto"
																			/>
																		) : null}
																	</CommandItem>
																);
															})}
														</CommandGroup>
													</CommandList>
												</Command>
											</DropdownMenuContent>
										</DropdownMenu>
									) : (
										sponsorStatusBadgeWithTooltip
									)}
								</PropertyField>
								{competition.sponsorPropertyStatus === "sponsor" &&
									competition.sponsorWinningBidCents !== undefined && (
										<PropertyField
											label="Winning bid"
											icon={<Gavel className="size-3.5" />}
										>
											<span className="text-sm">
												{formatWinningBid(competition.sponsorWinningBidCents)}
											</span>
										</PropertyField>
									)}
							</div>

							<div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/50">
								{competition.compSheet ? (
									<div className="inline-flex rounded-md border border-border">
										<Button
											variant="ghost"
											size="sm"
											className="h-7 gap-1.5 rounded-r-none border-r border-border"
											asChild
										>
											<a
												href={`https://docs.google.com/spreadsheets/d/${competition.compSheet.sheetId}`}
												target="_blank"
												rel="noreferrer"
											>
												<FileSpreadsheet className="size-3.5 text-success" />
												Open sheet
												<ExternalLink className="size-3 text-muted-foreground" />
											</a>
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 px-2 rounded-l-none text-destructive hover:text-destructive"
											onClick={() => {
												void updateCompetition(competition.id, {
													compSheet: null,
												}).catch(onMutationError);
											}}
										>
											<Trash2 className="size-3.5" />
										</Button>
									</div>
								) : (
									<Popover
										open={sheetPopoverOpen}
										onOpenChange={(open: boolean) => {
											setSheetPopoverOpen(open);
											if (!open) setSheetInput("");
										}}
									>
										<PopoverTrigger asChild>
											<Button variant="outline" size="sm" className="h-7">
												<FileSpreadsheet className="size-3.5 text-success" />
												Add sheet
											</Button>
										</PopoverTrigger>
										<PopoverContent
											align="start"
											className="w-[min(18rem,calc(100vw-1rem))] p-3"
										>
											<PopoverHeader className="p-0 pb-2">
												<PopoverTitle className="text-xs font-medium">
													Link or sheet ID
												</PopoverTitle>
											</PopoverHeader>
											<div className="flex gap-2">
												<Input
													placeholder="Paste link or ID..."
													value={sheetInput}
													onChange={(e) => setSheetInput(e.target.value)}
													className="h-8 flex-1 text-sm"
												/>
												<Button
													size="sm"
													className="h-8 shrink-0"
													disabled={!parseGoogleSheetId(sheetInput)}
													onClick={() => {
														const sheetId = parseGoogleSheetId(sheetInput);
														if (sheetId) {
															void updateCompetition(competition.id, {
																compSheet: { type: "google-sheet", sheetId },
															}).catch(onMutationError);
															setSheetInput("");
															setSheetPopoverOpen(false);
														}
													}}
												>
													Add
												</Button>
											</div>
										</PopoverContent>
									</Popover>
								)}

								{competition.wcaUrl ? (
									<div className="inline-flex rounded-md border border-border">
										<Button
											variant="ghost"
											size="sm"
											className="h-7 gap-1.5 rounded-r-none border-r border-border"
											asChild
										>
											<a
												href={competition.wcaUrl}
												target="_blank"
												rel="noreferrer"
											>
												<Globe className="size-3.5 text-info" />
												Open on WCA
												<ExternalLink className="size-3 text-muted-foreground" />
											</a>
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 px-2 rounded-l-none text-destructive hover:text-destructive"
											onClick={() => {
												void updateCompetition(competition.id, {
													wcaCompetitionId: null,
												}).catch(onMutationError);
											}}
										>
											<Trash2 className="size-3.5" />
										</Button>
									</div>
								) : (
									<Popover
										open={wcaPopoverOpen}
										onOpenChange={(open: boolean) => {
											setWcaPopoverOpen(open);
											if (open && !wcaMyCompsLoaded) {
												setWcaSearching(true);
												void fetchMyWcaCompetitions({})
													.then((results) => {
														setWcaMyComps(results as WcaSearchResult[]);
														setWcaMyCompsLoaded(true);
													})
													.catch(() => {
														toast.error("Failed to load your WCA competitions");
													})
													.finally(() => setWcaSearching(false));
											}
											if (!open) {
												setWcaSearchQuery("");
												setWcaSearchResults([]);
												setWcaSearchAll(false);
											}
										}}
									>
										<PopoverTrigger asChild>
											<Button variant="outline" size="sm" className="h-7">
												<Globe className="size-3.5 text-info" />
												Link to WCA
											</Button>
										</PopoverTrigger>
										<PopoverContent
											align="start"
											className="w-[min(22rem,calc(100vw-1rem))] p-3"
										>
											<PopoverHeader className="p-0 pb-2">
												<PopoverTitle className="text-xs font-medium">
													{wcaSearchAll
														? "Search all WCA competitions"
														: "My WCA competitions"}
												</PopoverTitle>
											</PopoverHeader>
											<div className="flex gap-2">
												<Input
													placeholder={
														wcaSearchAll
															? "Search all competitions..."
															: "Filter my competitions..."
													}
													value={wcaSearchQuery}
													onChange={(e) => {
														setWcaSearchQuery(e.target.value);
														if (!wcaSearchAll) setWcaSearchResults([]);
													}}
													onKeyDown={(e) => {
														if (
															e.key === "Enter" &&
															wcaSearchAll &&
															wcaSearchQuery.trim()
														) {
															setWcaSearching(true);
															void searchWcaCompetitions({
																query: wcaSearchQuery.trim(),
															})
																.then((results) =>
																	setWcaSearchResults(
																		results as WcaSearchResult[],
																	),
																)
																.catch(() =>
																	toast.error(
																		"Failed to search WCA competitions",
																	),
																)
																.finally(() => setWcaSearching(false));
														}
													}}
													className="h-8 flex-1 text-sm"
												/>
												{wcaSearchAll && (
													<Button
														size="sm"
														className="h-8 shrink-0"
														disabled={!wcaSearchQuery.trim() || wcaSearching}
														onClick={() => {
															setWcaSearching(true);
															void searchWcaCompetitions({
																query: wcaSearchQuery.trim(),
															})
																.then((results) =>
																	setWcaSearchResults(
																		results as WcaSearchResult[],
																	),
																)
																.catch(() =>
																	toast.error(
																		"Failed to search WCA competitions",
																	),
																)
																.finally(() => setWcaSearching(false));
														}}
													>
														{wcaSearching ? (
															<Loader2 className="size-3.5 animate-spin" />
														) : (
															<Search className="size-3.5" />
														)}
													</Button>
												)}
											</div>
											{wcaSearching && !wcaMyCompsLoaded && (
												<div className="mt-3 flex items-center justify-center">
													<Loader2 className="size-4 animate-spin text-muted-foreground" />
												</div>
											)}
											{(() => {
												const items = wcaSearchAll
													? wcaSearchResults
													: wcaMyComps.filter(
															(c) =>
																!wcaSearchQuery.trim() ||
																c.name
																	.toLowerCase()
																	.includes(
																		wcaSearchQuery.trim().toLowerCase(),
																	),
														);
												if (items.length === 0 && !wcaSearching) return null;
												return (
													<div className="mt-2 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
														{items.map((result) => (
															<button
																type="button"
																key={result.id}
																disabled={wcaLinking === result.id}
																className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
																onClick={() => {
																	setWcaLinking(result.id);
																	void updateCompetition(competition.id, {
																		wcaCompetitionId: result.id,
																	})
																		.then(() => {
																			setWcaPopoverOpen(false);
																			setWcaSearchQuery("");
																			setWcaSearchResults([]);
																			setWcaSearchAll(false);
																			toast.success(`Linked to ${result.name}`);
																		})
																		.catch(onMutationError)
																		.finally(() => setWcaLinking(null));
																}}
															>
																<span className="font-medium leading-tight">
																	{result.name}
																</span>
																<span className="text-xs text-muted-foreground">
																	{result.city} · {result.start_date}
																</span>
															</button>
														))}
													</div>
												);
											})()}
											<button
												type="button"
												className="mt-2 text-xs text-muted-foreground hover:text-foreground"
												onClick={() => {
													setWcaSearchAll(!wcaSearchAll);
													setWcaSearchQuery("");
													setWcaSearchResults([]);
												}}
											>
												{wcaSearchAll
													? "← Back to my competitions"
													: "Search all competitions →"}
											</button>
										</PopoverContent>
									</Popover>
								)}

								{competition.discordChannel ? (
									<div className="inline-flex rounded-md border border-border">
										<Button
											variant="ghost"
											size="sm"
											className="h-7 gap-1.5 rounded-r-none border-r border-border"
										>
											<MessageSquare className="size-3.5 text-primary" />#
											{competition.discordChannel.channelName}
										</Button>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 px-2 rounded-l-none"
												>
													<MoreHorizontal className="size-3.5" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="start" className="w-48">
												<DropdownMenuItem
													variant="destructive"
													onClick={() => {
														void updateCompetition(competition.id, {
															discordChannel: null,
														}).catch(onMutationError);
													}}
												>
													<Trash2 className="size-3.5" />
													Remove channel
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								) : (
									<Popover
										open={discordPopoverOpen}
										onOpenChange={(open: boolean) => {
											setDiscordPopoverOpen(open);
											if (open && discordChannels.length === 0) {
												setDiscordChannelsLoading(true);
												void listGuildChannels()
													.then((channels) => {
														setDiscordChannels(
															channels.filter(
																(channel) => channel.name.trim().length > 0,
															),
														);
													})
													.catch(() => {
														toast.error("Failed to load Discord channels");
													})
													.finally(() => setDiscordChannelsLoading(false));
											}
										}}
									>
										<PopoverTrigger asChild>
											<Button variant="outline" size="sm" className="h-7">
												<MessageSquare className="size-3.5 text-primary" />
												Link Discord channel
											</Button>
										</PopoverTrigger>
										<PopoverContent
											align="start"
											className="w-[min(20rem,calc(100vw-1rem))] p-3"
										>
											<PopoverHeader className="p-0 pb-2">
												<PopoverTitle className="text-xs font-medium">
													Competition channel
												</PopoverTitle>
											</PopoverHeader>
											{discordChannelsLoading ? (
												<div className="flex items-center justify-center py-4">
													<Loader2 className="size-4 animate-spin text-muted-foreground" />
												</div>
											) : (
												<div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
													{discordChannels.map((channel) => (
														<button
															key={channel.id}
															type="button"
															className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
															onClick={() => {
																void updateCompetition(competition.id, {
																	discordChannel: {
																		guildId: channel.guildId,
																		channelId: channel.id,
																		channelName: channel.name,
																		usesGlobalDefaults: true,
																		notificationTypeOverrides: [],
																	} as Competition["discordChannel"],
																})
																	.then(() => setDiscordPopoverOpen(false))
																	.catch(onMutationError);
															}}
														>
															#{channel.name}
														</button>
													))}
												</div>
											)}
										</PopoverContent>
									</Popover>
								)}
							</div>
						</section>

						<section className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5 sm:py-5">
							<h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
								<Users className="size-4" />
								People
							</h3>
							<div className="space-y-1">
								<PropertyField label="Competition lead">
									<EditableCompLeadCell competition={competition} />
								</PropertyField>
								<PropertyField label="Lead delegate">
									<EditableLeadDelegateCell competition={competition} />
								</PropertyField>
								<PropertyField label="Organisers">
									<EditableOrganisersCell competition={competition} />
								</PropertyField>
							</div>
						</section>
					</div>

					<section className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5 sm:py-5">
						<h3 className="text-sm font-semibold mb-3">Phases</h3>
						<CompetitionPhaseStatusList
							competition={competition}
							onSelectPhase={(phaseId) => {
								void updateCompetition(competition.id, {
									currentPhaseId: phaseId,
								}).catch(onMutationError);
							}}
						/>
					</section>

					<CompetitionLatestUpdate competition={competitionWithTasks} />

					<Separator />

					<CompetitionTasksByPhase
						competition={competitionWithTasks}
						tasks={scopedTasks}
					/>

					<section className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5 sm:py-5">
						<div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
							<div>
								<span className="font-medium">Created:</span>{" "}
								{formatDate(competition.createdAt)}
							</div>
							<div>
								<span className="font-medium">Updated:</span>{" "}
								{formatDate(competition.updatedAt)}
							</div>
						</div>
						<div className="mt-4">
							<Button
								variant="destructive"
								size="sm"
								onClick={() => setDeleteDialogOpen(true)}
								className="gap-2"
							>
								<Trash2 className="size-4" />
								Delete competition
							</Button>
						</div>
					</section>
				</div>
			</div>

			<ConfirmDeleteDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				title="Delete Competition?"
				description={
					<>
						Are you sure you want to permanently delete &quot;{competition.name}
						&quot;? This will delete all tasks, subtasks, comments, reactions,
						updates, and other associated data. This action cannot be undone.
					</>
				}
				onConfirm={handleDelete}
			/>

			<TitleDescriptionEditModal
				open={detailsModalOpen}
				onOpenChange={setDetailsModalOpen}
				entityLabel="Competition"
				initialTitle={competition.name}
				initialDescription={competition.description ?? ""}
				initialFocusField={detailsModalFocusField}
				onSave={handleSaveDetails}
			/>
		</div>
	);
}
