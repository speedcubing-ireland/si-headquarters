"use client";

import {
	CalendarDays,
	CalendarSync,
	Circle,
	ExternalLink,
	FileSpreadsheet,
	Globe,
	Loader2,
	MoreHorizontal,
	Search,
	Users,
} from "lucide-react";
import { useAction } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

function parseGoogleSheetId(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
	if (urlMatch) return urlMatch[1];
	if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
	return null;
}

import {
	EditableCompLeadCell,
	EditableLeadDelegateCell,
	EditableOrganisersCell,
	EditablePhaseCell,
} from "@/components/competitions/editable-phase-and-roles";
import { PropertyRow } from "@/components/shared/property-editors/property-row";
import { PropertiesSidebarLayout } from "@/components/shared/properties-sidebar-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useCompetitionMutations } from "@/hooks/use-convex-data";
import type { Competition, Task } from "@/data/types-new";
import { formatDateShort } from "@/lib/format-utils";
import { cn, onMutationError } from "@/lib/utils";

interface CompetitionPropertiesSidebarProps {
	competition: Competition;
	tasks: Task[];
	renderMode?: "sidebar" | "popover";
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	triggerClassName?: string;
	showMobileTrigger?: boolean;
}

type WcaSearchResult = {
	id: string;
	name: string;
	city: string;
	country_iso2: string;
	start_date: string;
	end_date: string;
	event_ids: string[];
};

export function CompetitionPropertiesSidebar({
	competition,
	tasks,
	renderMode = "sidebar",
	open: controlledOpen,
	onOpenChange,
	triggerClassName,
	showMobileTrigger = true,
}: CompetitionPropertiesSidebarProps) {
	const { updateCompetition } = useCompetitionMutations();
	const [dateOpen, setDateOpen] = useState(false);
	const [sheetInput, setSheetInput] = useState("");
	const [sheetPopoverOpen, setSheetPopoverOpen] = useState(false);
	const [wcaSearchQuery, setWcaSearchQuery] = useState("");
	const [wcaSearchResults, setWcaSearchResults] = useState<WcaSearchResult[]>([]);
	const [wcaMyComps, setWcaMyComps] = useState<WcaSearchResult[]>([]);
	const [wcaMyCompsLoaded, setWcaMyCompsLoaded] = useState(false);
	const [wcaSearching, setWcaSearching] = useState(false);
	const [wcaPopoverOpen, setWcaPopoverOpen] = useState(false);
	const [wcaLinking, setWcaLinking] = useState<string | null>(null);
	const [wcaSearchAll, setWcaSearchAll] = useState(false);
	const [wcaPushing, setWcaPushing] = useState(false);
	const searchWcaCompetitions = useAction(api.wca.searchCompetitions);
	const fetchMyWcaCompetitions = useAction(api.wca.fetchMyCompetitions);
	const pushScheduleToWca = useAction(api.wcaSchedule.pushScheduleToWca);

	const totalTasks = tasks.length;
	const completedTasks = tasks.filter((task) => task.status === "done").length;
	const inProgressTasks = tasks.filter(
		(task) => task.status === "in-progress",
	).length;

	const handleSetDateRange = useCallback(
		(range: { from?: Date; to?: Date }) => {
			void updateCompetition(competition.id, {
				compStart:
					range.from?.toISOString().split("T")[0] || competition.compStart,
				compEnd: range.to?.toISOString().split("T")[0] || competition.compEnd,
			}).catch(onMutationError);
		},
		[
			competition.id,
			competition.compStart,
			competition.compEnd,
			updateCompetition,
		],
	);

	const sidebarContent = (
		<div className="flex min-w-0 flex-col gap-6 px-4 py-4 sm:px-5 sm:py-5">
			<section className="flex flex-col gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Properties
				</h3>
				<div className="flex flex-col gap-1">
					<PropertyRow label="Phase" icon={<Circle className="size-3.5" />}>
						<EditablePhaseCell competition={competition} />
					</PropertyRow>

					<PropertyRow
						label="Dates"
						icon={<CalendarDays className="size-3.5" />}
					>
						<DropdownMenu open={dateOpen} onOpenChange={setDateOpen}>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-7 min-w-0 max-w-full px-2"
								>
									<span className="text-sm">
										{formatDateShort(competition.compStart)} –{" "}
										{formatDateShort(competition.compEnd)}
									</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="w-auto p-0" align="end">
								<Calendar
									mode="range"
									selected={{
										from: new Date(competition.compStart),
										to: new Date(competition.compEnd),
									}}
									onSelect={(range) => {
										if (range?.from || range?.to) {
											handleSetDateRange(range);
										}
										setDateOpen(false);
									}}
									numberOfMonths={1}
								/>
							</DropdownMenuContent>
						</DropdownMenu>
					</PropertyRow>

					<PropertyRow label="Tasks">
						<span className="max-w-full text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">
							<span className="text-foreground font-medium">
								{completedTasks}
							</span>{" "}
							done ·{" "}
							<span className="text-foreground font-medium">
								{inProgressTasks}
							</span>{" "}
							in progress ·{" "}
							<span className="text-foreground font-medium">{totalTasks}</span>{" "}
							total
						</span>
					</PropertyRow>

					<div className="flex min-h-9 flex-col gap-2 px-3 -mx-3">
						{competition.compSheet ? (
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="sm"
									className="h-7 min-w-0 flex-1 justify-start gap-1.5 px-2 font-normal"
									asChild
								>
									<a
										href={`https://docs.google.com/spreadsheets/d/${competition.compSheet.sheetId}`}
										target="_blank"
										rel="noreferrer"
									>
										<FileSpreadsheet className="size-3.5 shrink-0 text-green-600" />
										<span className="truncate">Open sheet</span>
										<ExternalLink className="size-3 shrink-0 text-muted-foreground" />
									</a>
								</Button>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 shrink-0"
										>
											<MoreHorizontal className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-48">
										<DropdownMenuItem asChild>
											<a
												href={`https://docs.google.com/spreadsheets/d/${competition.compSheet.sheetId}`}
												target="_blank"
												rel="noreferrer"
											>
												<ExternalLink className="size-4" />
												Open
											</a>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											onClick={() => {
												void updateCompetition(competition.id, {
													compSheet: null,
												}).catch(onMutationError);
											}}
										>
											Remove
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
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
										<FileSpreadsheet className="size-3.5 text-green-600" />
										Add sheet
									</Button>
								</PopoverTrigger>
								<PopoverContent
									align="end"
									className="w-[min(18rem,calc(100vw-1rem))] p-3"
									sideOffset={6}
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
														compSheet: {
															type: "google-sheet",
															sheetId,
														},
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
					</div>

					<div className="flex min-h-9 flex-col gap-2 px-3 -mx-3">
						{competition.wcaCompetitionId ? (
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="sm"
									className="h-7 min-w-0 flex-1 justify-start gap-1.5 px-2 font-normal"
									asChild
								>
									<a
										href={`https://www.worldcubeassociation.org/competitions/${competition.wcaCompetitionId}`}
										target="_blank"
										rel="noreferrer"
									>
										<Globe className="size-3.5 shrink-0 text-blue-600" />
										<span className="truncate">Open on WCA</span>
										<ExternalLink className="size-3 shrink-0 text-muted-foreground" />
									</a>
								</Button>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 shrink-0"
										>
											<MoreHorizontal className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-56">
										<DropdownMenuItem asChild>
											<a
												href={`https://www.worldcubeassociation.org/competitions/${competition.wcaCompetitionId}`}
												target="_blank"
												rel="noreferrer"
											>
												<ExternalLink className="size-4" />
												Open
											</a>
										</DropdownMenuItem>
										{competition.compSheet && (
											<DropdownMenuItem
												disabled={wcaPushing}
												onClick={() => {
													setWcaPushing(true);
													void pushScheduleToWca({
														competitionId: competition.id,
													})
														.then((result) => {
															if (result.success) {
																toast.success(
																	`Schedule pushed to WCA (${result.activitiesCreated} activities)`,
																);
															} else {
																toast.error(
																	result.error ?? "Failed to push schedule",
																);
															}
														})
														.catch(() => {
															toast.error("Failed to push schedule to WCA");
														})
														.finally(() => setWcaPushing(false));
												}}
											>
												{wcaPushing ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													<CalendarSync className="size-4" />
												)}
												Push schedule to WCA
											</DropdownMenuItem>
										)}
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											onClick={() => {
												void updateCompetition(competition.id, {
													wcaCompetitionId: null,
												}).catch(onMutationError);
											}}
										>
											Remove
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
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
										<Globe className="size-3.5 text-blue-600" />
										Link to WCA
									</Button>
								</PopoverTrigger>
								<PopoverContent
									align="end"
									className="w-[min(22rem,calc(100vw-1rem))] p-3"
									sideOffset={6}
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
												if (!wcaSearchAll) {
													setWcaSearchResults([]);
												}
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
														.then((results) => {
															setWcaSearchResults(
																results as WcaSearchResult[],
															);
														})
														.catch(() => {
															toast.error(
																"Failed to search WCA competitions",
															);
														})
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
														.then((results) => {
															setWcaSearchResults(
																results as WcaSearchResult[],
															);
														})
														.catch(() => {
															toast.error(
																"Failed to search WCA competitions",
															);
														})
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
																	toast.success(
																		`Linked to ${result.name}`,
																	);
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
					</div>
				</div>
			</section>

			<Separator />

			<section className="flex flex-col gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					People
				</h3>
				<div className="flex flex-col gap-1">
					<PropertyRow label="Competition lead">
						<EditableCompLeadCell competition={competition} />
					</PropertyRow>

					<PropertyRow label="Lead delegate">
						<EditableLeadDelegateCell competition={competition} />
					</PropertyRow>

					<PropertyRow label="Organisers" icon={<Users className="size-3.5" />}>
						<EditableOrganisersCell competition={competition} />
					</PropertyRow>
				</div>
			</section>

			<Separator />

			<section className="flex flex-col gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					All Phases
				</h3>
				<div className="flex flex-col gap-0.5">
					{competition.phases.map((phase, index) => {
						const isCurrent = index === competition.currentPhaseIdx;

						return (
							<button
								key={phase.id}
								type="button"
								onClick={() => {
									void updateCompetition(competition.id, {
										currentPhaseId: phase.id,
									}).catch(onMutationError);
								}}
								className={cn(
									"flex min-w-0 w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors",
									isCurrent
										? "bg-accent text-foreground"
										: "hover:bg-accent text-muted-foreground",
								)}
							>
								<div className="flex min-w-0 items-center gap-2">
									<Circle
										className={cn(
											"size-2",
											isCurrent
												? "text-warning fill-warning"
												: "text-muted-foreground/40",
										)}
									/>
									<span
										className={cn(
											"min-w-0 truncate",
											isCurrent ? "font-medium" : "",
										)}
									>
										{phase.name}
									</span>
								</div>
								{isCurrent && (
									<Badge
										variant="outline"
										className="h-5 border-border bg-background text-[10px] font-normal"
									>
										Current
									</Badge>
								)}
							</button>
						);
					})}
				</div>
			</section>
		</div>
	);

	return (
		<PropertiesSidebarLayout
			renderMode={renderMode}
			open={controlledOpen}
			onOpenChange={onOpenChange}
			title="Properties"
			triggerClassName={triggerClassName}
			showMobileTrigger={showMobileTrigger}
		>
			{sidebarContent}
		</PropertiesSidebarLayout>
	);
}
