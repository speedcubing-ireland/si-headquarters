import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useCompetitions, useIsVolunteer } from "@/hooks/use-convex-data";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PermissionGuard } from "@/components/shared/permission-guard";

export const Route = createFileRoute("/events")({
	component: EventsPage,
});

type EventRow = { eventName: string; rounds: string };

type SheetResult =
	| { events: EventRow[]; fetchedAt: number }
	| { error: string };

const EVENT_SHORTHAND: Record<string, string> = {
	"3x3 Blindfolded": "3BLD",
	"3x3 Fewest Moves": "FMC",
	"3x3 One-Handed": "3OH",
	"3x3 One Handed": "3OH",
	Megaminx: "Mega",
	Pyraminx: "Pyra",
	"4x4 Blindfolded": "4BLD",
	"5x5 Blindfolded": "5BLD",
	"3x3 Multi-Blind": "MBLD",
	"Square-1": "SQ-1",
};

function eventDisplayName(name: string): string {
	return EVENT_SHORTHAND[name] ?? name;
}

function parseRoundCount(rounds: string): number {
	const n = Number.parseInt(rounds, 10);
	return Number.isNaN(n) ? 0 : n;
}

type CompWithSheet = {
	id: string;
	name: string;
	compSheet: { sheetId: string };
};

async function fetchSchedulesForComps(
	comps: CompWithSheet[],
	fetchScheduleEvents: (args: {
		sheetId: string;
		skipCache?: boolean;
	}) => Promise<{ events: EventRow[]; fetchedAt: number } | { error: string }>,
	skipCache: boolean,
): Promise<Map<string, SheetResult>> {
	const results = new Map<string, SheetResult>();
	await Promise.all(
		comps.map(async (comp) => {
			const raw = await fetchScheduleEvents({
				sheetId: comp.compSheet.sheetId,
				...(skipCache && { skipCache: true }),
			}).catch((err: unknown) => ({
				error: err instanceof Error ? err.message : "Sheet unavailable",
			}));
			const value: SheetResult =
				"error" in raw ? raw : { events: raw.events, fetchedAt: raw.fetchedAt };
			results.set(comp.id, value);
		}),
	);
	return results;
}

function EventsPage() {
	const { isVolunteer, isLoading: isVolunteerLoading } = useIsVolunteer();
	const { competitions, isLoading: competitionsLoading } = useCompetitions();
	const fetchScheduleEvents = useAction(api.sheets.fetchScheduleEvents);
	const [sheetResults, setSheetResults] = useState<Map<string, SheetResult>>(
		new Map(),
	);
	const [refreshing, setRefreshing] = useState(false);

	const compsWithSheet = useMemo(
		() =>
			competitions.filter(
				(c): c is typeof c & { compSheet: { sheetId: string } } =>
					Boolean(c.compSheet?.sheetId),
			),
		[competitions],
	);

	const compsWithSheetKey = useMemo(
		() =>
			compsWithSheet
				.map((c) => `${c.id}:${c.compSheet.sheetId}`)
				.sort()
				.join(","),
		[compsWithSheet],
	);
	const compsRef = useRef(compsWithSheet);
	compsRef.current = compsWithSheet;

	useEffect(() => {
		const comps = compsRef.current;
		if (comps.length === 0) {
			setSheetResults(new Map());
			return;
		}
		let cancelled = false;
		void fetchSchedulesForComps(comps, fetchScheduleEvents, false).then(
			(results) => {
				if (!cancelled) setSheetResults(results);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [compsWithSheetKey, fetchScheduleEvents]);

	async function handleRefresh() {
		if (compsWithSheet.length === 0) return;
		setRefreshing(true);
		try {
			const results = await fetchSchedulesForComps(
				compsWithSheet,
				fetchScheduleEvents,
				true,
			);
			setSheetResults(results);
		} finally {
			setRefreshing(false);
		}
	}

	const eventColumns = useMemo(() => {
		const order: string[] = [];
		const seen = new Set<string>();
		for (const comp of compsWithSheet) {
			const result = sheetResults.get(comp.id);
			if (!result || "error" in result) continue;
			for (const e of result.events) {
				if (!seen.has(e.eventName)) {
					seen.add(e.eventName);
					order.push(e.eventName);
				}
			}
		}
		return order;
	}, [compsWithSheet, sheetResults]);

	const competitionRows = useMemo(() => {
		return compsWithSheet
			.map((comp) => {
				const result = sheetResults.get(comp.id);
				if (!result) return null;
				if ("error" in result) {
					return {
						competitionId: comp.id,
						competitionName: comp.name,
						error: result.error,
						eventRounds: new Map<string, string>(),
					};
				}
				const eventRounds = new Map<string, string>();
				let totalRounds = 0;
				for (const e of result.events) {
					eventRounds.set(e.eventName, e.rounds);
					totalRounds += parseRoundCount(e.rounds);
				}
				return {
					competitionId: comp.id,
					competitionName: comp.name,
					eventRounds,
					totalRounds,
				};
			})
			.filter((row): row is NonNullable<typeof row> => row !== null);
	}, [compsWithSheet, sheetResults]);

	const loading =
		competitionsLoading ||
		(compsWithSheet.length > 0 && sheetResults.size < compsWithSheet.length);

	const lastUpdated = useMemo(() => {
		let latest = 0;
		for (const result of sheetResults.values()) {
			if (!("error" in result) && result.fetchedAt > latest) {
				latest = result.fetchedAt;
			}
		}
		return latest > 0 ? latest : null;
	}, [sheetResults]);

	return (
		<PermissionGuard
			isLoading={isVolunteerLoading}
			canAccess={isVolunteer}
			fallback={
				<div className="flex h-full flex-col items-center justify-center gap-4 px-4">
					<p className="text-sm text-muted-foreground">
						Access to Events is restricted to volunteers.
					</p>
					<Link
						to="/competitions"
						className="text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						Back to Competitions
					</Link>
				</div>
			}
		>
			<div className="flex h-full flex-col">
				<header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4 lg:h-12 lg:flex-nowrap lg:px-6 lg:py-0">
					<div className="flex min-w-0 flex-1 items-center gap-3">
						<SidebarTrigger className="shrink-0" />
						<Separator
							orientation="vertical"
							className="hidden data-[orientation=vertical]:h-3 sm:block"
						/>
						<h1 className="text-sm font-semibold">Events</h1>
						{lastUpdated != null && (
							<span className="hidden text-xs text-muted-foreground sm:inline">
								Last updated{" "}
								{formatDistanceToNow(lastUpdated, { addSuffix: true })}
							</span>
						)}
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={refreshing || compsWithSheet.length === 0}
						onClick={handleRefresh}
						className="gap-2"
					>
						<RefreshCw
							className={`size-4 ${refreshing ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
				</header>
				<div className="flex-1 overflow-y-auto">
					<div className="w-full px-4 py-4 lg:px-6 lg:py-6">
						{loading && (
							<p className="text-sm text-muted-foreground">Loading events…</p>
						)}
						{!loading && compsWithSheet.length === 0 && (
							<p className="text-sm text-muted-foreground">
								No competitions with a linked Google Sheet.
							</p>
						)}
						{!loading && competitionRows.length > 0 && (
							<div className="w-full overflow-x-auto rounded-md border">
								<Table className="text-xs">
									<TableHeader>
										<TableRow>
											<TableHead className="sticky left-0 z-10 min-w-36 bg-background px-2 py-1.5 font-semibold">
												Competition
											</TableHead>
											{eventColumns.map((eventName) => (
												<TableHead
													key={eventName}
													className="px-1.5 py-1.5 text-center font-medium whitespace-nowrap"
												>
													{eventDisplayName(eventName)}
												</TableHead>
											))}
											<TableHead className="sticky right-0 z-10 bg-background px-2 py-1.5 text-center font-semibold">
												Total
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{competitionRows.map((row) => (
											<TableRow key={row.competitionId}>
												<TableCell className="sticky left-0 z-10 bg-background px-2 py-1.5 font-medium">
													{row.error
														? `${row.competitionName} (${row.error})`
														: row.competitionName}
												</TableCell>
												{eventColumns.map((eventName) => {
													const value = row.error
														? "—"
														: (row.eventRounds.get(eventName) ?? "—");
													return (
														<TableCell
															key={eventName}
															className={`px-1.5 py-1.5 text-center ${
																value === "—"
																	? "text-muted-foreground/40"
																	: "text-foreground"
															}`}
														>
															{value}
														</TableCell>
													);
												})}
												<TableCell className="sticky right-0 z-10 bg-background px-2 py-1.5 text-center font-semibold tabular-nums">
													{row.error ? "—" : row.totalRounds}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</div>
				</div>
			</div>
		</PermissionGuard>
	);
}
