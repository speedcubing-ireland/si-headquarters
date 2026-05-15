import { formatInTimeZone } from "date-fns-tz";
import { useAction } from "convex/react";
import {
	AlertTriangle,
	ExternalLink,
	Loader2,
	Megaphone,
	RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppPageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatDate, formatDateRangeForDisplay } from "@/lib/format-utils";
import { getConvexErrorData } from "@/lib/utils";
import { formatWcaEventLabel } from "@/lib/wca-event-labels";

const DUBLIN_TZ = "Europe/Dublin";

type DashboardCompetition = {
	id: string;
	name: string;
	start_date: string;
	end_date: string;
	event_ids: string[];
	competitor_limit: number | null;
	registration_open: string | null;
	sponsor_labels: string[];
	url: string;
};

function getSocialDashboardErrorMessage(error: unknown): string {
	const data = getConvexErrorData(error);
	if (data.message) return data.message;
	if (data.code === "PRECONDITION_FAILED") {
		return "WCA is not connected. Run bun run auth wca from repo root to connect.";
	}
	if (data.code === "FORBIDDEN") {
		return "You don't have access to this dashboard.";
	}
	if (error instanceof Error) return error.message;
	return "Failed to load competitions.";
}

function formatDateRangeWithFallback(start: string, end: string): string {
	const s = formatDateRangeForDisplay({ start, end }, formatDate);
	return s || "Dates not available";
}

function formatDublinDateTime(date: string | null | undefined): string {
	if (!date) return "Not available";
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return date;
	return `${formatInTimeZone(parsed, DUBLIN_TZ, "MMM d, yyyy 'at' HH:mm")} (Dublin)`;
}

export function SocialMediaDashboard() {
	const fetchDashboardData = useAction(
		api.integrations.wca.actions.fetchSocialMediaDashboardCompetitions,
	);
	const [competitions, setCompetitions] = useState<
		DashboardCompetition[] | null
	>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	const load = useCallback(
		async (mode: "initial" | "refresh" = "initial") => {
			if (mode === "initial") {
				setLoading(true);
			} else {
				setRefreshing(true);
			}
			setError(null);
			try {
				const result = await fetchDashboardData({});
				setCompetitions(result);
			} catch (err) {
				setCompetitions(null);
				setError(getSocialDashboardErrorMessage(err));
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[fetchDashboardData],
	);

	useEffect(() => {
		void load("initial");
	}, [load]);

	return (
		<div className="flex flex-1 flex-col">
			<AppPageHeader
				title="Social Media"
				subtitle="WCA competitions you manage — sponsors and registration details"
				actions={
					<Button
						variant="outline"
						onClick={() => void load("refresh")}
						disabled={loading || refreshing}
					>
						{refreshing ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<RefreshCw className="size-4" />
						)}
						Refresh
					</Button>
				}
			/>
			<div className="flex-1 p-4 lg:p-6">
				<div className="mx-auto w-full max-w-6xl space-y-6">
					{error ? (
						<Alert variant="destructive">
							<AlertTriangle className="size-4" />
							<AlertTitle>Dashboard unavailable</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}

					{loading ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" />
							Loading competitions...
						</div>
					) : null}

					{!loading && !error && competitions?.length === 0 ? (
						<Card className="border-dashed">
							<CardHeader>
								<div className="flex items-center gap-2">
									<Megaphone className="size-4 text-muted-foreground" />
									<CardTitle>No competitions found</CardTitle>
								</div>
								<CardDescription>
									No managed competitions were returned by WCA for this account.
								</CardDescription>
							</CardHeader>
						</Card>
					) : null}

					{!loading && !error && competitions && competitions.length > 0 ? (
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
							{competitions.map((competition) => (
								<Card key={competition.id} className="flex flex-col">
									<CardHeader className="pb-2">
										<div className="flex items-start justify-between gap-2">
											<CardTitle className="line-clamp-2 text-base">
												{competition.name}
											</CardTitle>
											<a
												href={competition.url}
												target="_blank"
												rel="noopener noreferrer"
												className="shrink-0 text-muted-foreground hover:text-foreground"
												aria-label={`Open ${competition.name} on WCA`}
											>
												<ExternalLink className="size-4" />
											</a>
										</div>
										<CardDescription>
											{formatDateRangeWithFallback(
												competition.start_date,
												competition.end_date,
											)}
										</CardDescription>
									</CardHeader>
									<CardContent className="flex flex-1 flex-col gap-2 pt-0">
										<div className="flex flex-wrap gap-1 pb-1">
											{competition.event_ids.length > 0 ? (
												competition.event_ids.map((eventId) => (
													<Badge key={eventId} variant="outline">
														{formatWcaEventLabel(eventId)}
													</Badge>
												))
											) : (
												<span className="text-sm text-muted-foreground">
													Events not available
												</span>
											)}
										</div>
										<p className="text-sm text-muted-foreground">
											Competitor limit:{" "}
											{competition.competitor_limit ?? "Not set"}
										</p>
										<p className="text-sm text-muted-foreground">
											Registration opens:{" "}
											{formatDublinDateTime(competition.registration_open)}
										</p>
										<div className="mt-auto space-y-1 pt-2">
											<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
												Sponsor status
											</p>
											{competition.sponsor_labels.length > 0 ? (
												<div className="flex flex-wrap gap-1">
													{competition.sponsor_labels.map((label) => (
														<Badge key={label} variant="secondary">
															{label}
														</Badge>
													))}
												</div>
											) : (
												<p className="text-sm text-muted-foreground">
													None found
												</p>
											)}
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
