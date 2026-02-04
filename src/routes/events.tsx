import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { useCompetitions } from "@/hooks/use-convex-data";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
	const isVolunteer = useQuery(api.auth.isVolunteerQuery);
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
				for (const e of result.events) eventRounds.set(e.eventName, e.rounds);
				return {
					competitionId: comp.id,
					competitionName: comp.name,
					eventRounds,
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

	if (isVolunteer === false) {
		return (
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
		);
	}

	return (
		<div className="flex h-full flex-col">
			<header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4 lg:px-6">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					<h1 className="text-sm font-semibold">Events</h1>
					{lastUpdated != null && (
						<span className="text-xs text-muted-foreground">
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
					<RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
					Refresh
				</Button>
			</header>
			<ScrollArea className="flex-1">
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
						<div className="w-full overflow-auto rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="min-w-48 font-semibold">
											Competition
										</TableHead>
										{eventColumns.map((eventName) => (
											<TableHead
												key={eventName}
												className="min-w-16 text-center font-medium"
											>
												{eventDisplayName(eventName)}
											</TableHead>
										))}
									</TableRow>
								</TableHeader>
								<TableBody>
									{competitionRows.map((row) => (
										<TableRow key={row.competitionId}>
											<TableCell className="font-medium">
												{row.error
													? `${row.competitionName} (${row.error})`
													: row.competitionName}
											</TableCell>
											{eventColumns.map((eventName) => (
												<TableCell
													key={eventName}
													className="text-center text-muted-foreground"
												>
													{row.error
														? "—"
														: (row.eventRounds.get(eventName) ?? "—")}
												</TableCell>
											))}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
