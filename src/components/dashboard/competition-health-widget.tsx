import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DashboardWidgetCard } from "@/components/dashboard/dashboard-widget-card";
import { useCompetitions } from "@/hooks/use-convex-data";
import type { Competition } from "@/data/types-new";
import { cn } from "@/lib/utils";

const MAX_COMPETITIONS = 5;

const STATUS_DOT_COLORS: Record<string, string> = {
	"on-track": "bg-success",
	"at-risk": "bg-warning",
	"off-track": "bg-error",
};

const STATUS_SORT_ORDER: Record<string, number> = {
	"off-track": 0,
	"at-risk": 1,
	"on-track": 2,
};

export function getLatestUpdateStatus(
	comp: Competition,
): { status: string; message: string } | null {
	const updates = comp.progressUpdates;
	if (!updates || updates.length === 0) return null;
	const latest = updates[updates.length - 1];
	return { status: latest.status, message: latest.message ?? "" };
}

export function getCompetitionDaysText(
	compStart: string,
	compEnd: string,
): string {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const start = new Date(compStart);
	const end = new Date(compEnd);

	const daysToStart = Math.ceil(
		(start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
	);
	const daysToEnd = Math.ceil(
		(end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
	);

	if (daysToStart > 1) return `in ${daysToStart} days`;
	if (daysToStart === 1) return "Starts tomorrow";
	if (daysToStart === 0) return "Starts today";
	if (daysToEnd === 0) return "Ends today";
	if (daysToEnd === 1) return "Ends tomorrow";
	if (daysToEnd > 0) return "In progress";
	return "Ended";
}

export function getTaskProgress(comp: Competition): {
	done: number;
	total: number;
} {
	const tasks = comp.tasks ?? [];
	const currentPhaseId = comp.phases?.[comp.currentPhaseIdx ?? 0]?.id;
	const tasksInCurrentPhase = currentPhaseId
		? tasks.filter((task) => task.phaseId === currentPhaseId)
		: tasks;
	const done = tasksInCurrentPhase.filter(
		(task) => task.status === "done",
	).length;
	return { done, total: tasksInCurrentPhase.length };
}

export function getProgressPercent(done: number, total: number): number {
	if (total === 0) return 0;
	return Math.round((done / total) * 100);
}

function CompetitionCard({ competition }: { competition: Competition }) {
	const phaseName =
		competition.phases[competition.currentPhaseIdx]?.name ?? "Unknown";
	const daysText = getCompetitionDaysText(
		competition.compStart,
		competition.compEnd,
	);
	const { done, total } = getTaskProgress(competition);
	const percent = getProgressPercent(done, total);
	const latestUpdate = getLatestUpdateStatus(competition);

	return (
		<Link
			to="/competitions/$id"
			params={{ id: competition.id }}
			className="block min-w-0 rounded-lg border p-3 transition-colors hover:bg-muted/50"
		>
			<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
				<Badge variant="outline" className="shrink-0 text-[10px]">
					{phaseName}
				</Badge>
				<span className="min-w-0 flex-1 truncate text-sm font-medium">
					{competition.name}
				</span>
				<span className="basis-full text-xs text-muted-foreground sm:ml-auto sm:basis-auto">
					{daysText}
				</span>
			</div>
			<div className="mt-2 flex min-w-0 flex-wrap items-center gap-2.5">
				{competition.compLead && (
					<div className="flex min-w-0 max-w-full items-center gap-1.5 sm:max-w-[55%]">
						<UserAvatar user={competition.compLead} size="xs" />
						<span className="truncate text-xs text-muted-foreground">
							{competition.compLead.name}
						</span>
					</div>
				)}

				{total > 0 && (
					<div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-primary transition-all"
										style={{ width: `${percent}%` }}
									/>
								</div>
							</TooltipTrigger>
							<TooltipContent side="top" sideOffset={4}>
								{percent}% complete
							</TooltipContent>
						</Tooltip>
						<span className="shrink-0 text-[11px] text-muted-foreground">
							{done}/{total}
						</span>
					</div>
				)}
			</div>
			<div className="mt-1.5">
				{latestUpdate ? (
					<div className="flex min-w-0 items-center gap-1.5">
						<span
							className={cn(
								"inline-block size-2 shrink-0 rounded-full",
								STATUS_DOT_COLORS[latestUpdate.status] ?? "bg-muted-foreground",
							)}
						/>
						<span className="min-w-0 truncate text-xs text-muted-foreground">
							{latestUpdate.message || "No message"}
						</span>
					</div>
				) : (
					<span className="text-xs text-muted-foreground/60">
						No status update
					</span>
				)}
			</div>
		</Link>
	);
}

export function CompetitionHealthWidget() {
	const { competitions, isLoading } = useCompetitions();

	const activeCompetitions = useMemo(() => {
		const today = new Date().toISOString().split("T")[0];
		const active = competitions.filter((c) => c.compEnd >= today);

		return active.toSorted((a, b) => {
			const aUpdate = getLatestUpdateStatus(a);
			const bUpdate = getLatestUpdateStatus(b);
			const aOrder = aUpdate ? (STATUS_SORT_ORDER[aUpdate.status] ?? 3) : 3;
			const bOrder = bUpdate ? (STATUS_SORT_ORDER[bUpdate.status] ?? 3) : 3;

			if (aOrder !== bOrder) return aOrder - bOrder;
			return a.compStart.localeCompare(b.compStart);
		});
	}, [competitions]);

	return (
		<DashboardWidgetCard
			title="Competitions"
			footerText="View all competitions"
			footerTo="/competitions"
		>
			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={`skeleton-${i.toString()}`}
							className="rounded-lg border p-3"
						>
							<div className="flex items-center gap-2">
								<div className="h-5 w-20 animate-pulse rounded bg-muted" />
								<div className="h-4 flex-1 animate-pulse rounded bg-muted" />
							</div>
							<div className="mt-2 flex items-center gap-2">
								<div className="size-4 animate-pulse rounded-full bg-muted" />
								<div className="h-1.5 flex-1 animate-pulse rounded-full bg-muted" />
							</div>
						</div>
					))}
				</div>
			) : activeCompetitions.length === 0 ? (
				<div className="flex flex-1 items-center justify-center py-8">
					<span className="text-sm text-muted-foreground">
						No active competitions
					</span>
				</div>
			) : (
				<div className="min-w-0 space-y-2">
					{activeCompetitions.slice(0, MAX_COMPETITIONS).map((comp) => (
						<CompetitionCard key={comp.id} competition={comp} />
					))}
					{activeCompetitions.length > MAX_COMPETITIONS && (
						<p className="px-2 text-xs text-muted-foreground">
							and {activeCompetitions.length - MAX_COMPETITIONS} more
						</p>
					)}
				</div>
			)}
		</DashboardWidgetCard>
	);
}
