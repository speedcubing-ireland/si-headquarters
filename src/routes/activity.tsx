import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Activity, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGlobalActivity, useIsDirector } from "@/hooks/use-convex-data";
import {
	getActivityDescription,
	formatRelativeTime,
} from "@/lib/activity-utils";
import { getInitials } from "@/lib/format-utils";
import type { ActivityEntry } from "@/data/types-new";

export const Route = createFileRoute("/activity")({
	component: ActivityPage,
});

const LoadingSpinner = () => (
	<div className="flex h-full items-center justify-center">
		<Loader2 className="size-6 animate-spin text-muted-foreground" />
	</div>
);

function ActivityPage() {
	const { isDirector, isLoading: isDirectorLoading } = useIsDirector();
	const { activities, isLoading: activitiesLoading } = useGlobalActivity(100);

	if (isDirectorLoading) return <LoadingSpinner />;
	if (!isDirector) return <Navigate to="/" />;

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
				<Activity className="size-5 text-muted-foreground" />
				<h1 className="text-sm font-semibold">Activity</h1>
				<span className="text-xs text-muted-foreground">
					Global feed (directors only)
				</span>
			</header>

			<div className="flex-1 overflow-auto px-4 lg:px-6">
				{activitiesLoading ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : activities.length === 0 ? (
					<p className="py-12 text-center text-sm text-muted-foreground">
						No activity yet.
					</p>
				) : (
					<ul className="space-y-0">
						{activities.map((entry) => (
							<GlobalActivityItem key={entry.id} entry={entry} />
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function GlobalActivityItem({ entry }: { entry: ActivityEntry }) {
	const description = getActivityDescription(entry);
	const timeAgo = formatRelativeTime(entry.timestamp);
	const linkProps = getEntityLink(entry);

	return (
		<li className="border-b last:border-0">
			{linkProps ? (
				<Link
					to={linkProps.to}
					params={linkProps.params}
					className="flex gap-3 px-2 py-3 -mx-2 transition-colors hover:bg-muted/50 rounded-md"
				>
					<ActivityItemContent
						entry={entry}
						description={description}
						timeAgo={timeAgo}
					/>
				</Link>
			) : (
				<div className="flex gap-3 py-3">
					<ActivityItemContent
						entry={entry}
						description={description}
						timeAgo={timeAgo}
					/>
				</div>
			)}
		</li>
	);
}

function ActivityItemContent({
	entry,
	description,
	timeAgo,
}: {
	entry: ActivityEntry;
	description: string;
	timeAgo: string;
}) {
	return (
		<>
			<Avatar className="size-8 shrink-0">
				<AvatarImage src={entry.actor.avatarUrl} />
				<AvatarFallback className="text-xs">
					{getInitials(entry.actor.name)}
				</AvatarFallback>
			</Avatar>
			<div className="flex-1 min-w-0">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<span className="font-medium text-sm">{entry.actor.name}</span>{" "}
						<span className="text-sm text-muted-foreground">{description}</span>
					</div>
					<span
						className="text-xs text-muted-foreground shrink-0"
						title={entry.timestamp}
					>
						{timeAgo}
					</span>
				</div>
				<div className="mt-1 text-xs text-muted-foreground">
					{entry.entityType} · {entry.type.replace(/_/g, " ")}
				</div>
			</div>
		</>
	);
}

function getEntityLink(
	entry: ActivityEntry,
): { to: string; params?: Record<string, string> } | null {
	switch (entry.entityType) {
		case "task":
			return { to: "/tasks/$id", params: { id: entry.entityId } };
		case "competition":
			return { to: "/competitions/$id", params: { id: entry.entityId } };
		case "update":
			// Updates live under a competition; link to competition (could later deep-link to updates tab)
			return null;
		default:
			return null;
	}
}
