import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Activity, Loader2 } from "lucide-react";

import { useGlobalActivity, useIsDirector } from "@/hooks/use-convex-data";
import { getEntityLink } from "@/lib/activity-utils";
import type { ActivityEntry } from "@/data/types-new";
import { ActivityItemContent } from "@/components/shared/activity-item";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

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
			<header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4 lg:h-12 lg:flex-nowrap lg:px-6 lg:py-0">
				<SidebarTrigger className="shrink-0" />
				<Separator orientation="vertical" className="hidden h-4 sm:block" />
				<Activity className="size-5 text-muted-foreground" />
				<h1 className="text-sm font-semibold">Activity</h1>
				<span className="hidden text-xs text-muted-foreground sm:inline">
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
						showEntityDetails
						avatarSize="md"
					/>
				</Link>
			) : (
				<div className="flex gap-3 px-2 py-3 -mx-2">
					<ActivityItemContent
						entry={entry}
						showEntityDetails
						avatarSize="md"
					/>
				</div>
			)}
		</li>
	);
}
