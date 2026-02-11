import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowRight, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useRecentActivity } from "@/hooks/use-convex-data";
import { ActivityItemContent } from "@/components/shared/activity-item";
import { getEntityLink } from "@/lib/activity-utils";
import type { ActivityEntry } from "@/data/types-new";

const MAX_ITEMS = 15;

const HIGH_SIGNAL_TYPES = new Set([
	"comment_added",
	"comment_edited",
	"status_changed",
	"priority_changed",
	"assignee_changed",
	"phase_changed",
	"approved",
	"unapproved",
	"created",
	"archived",
]);

export type TimeGroup = "Today" | "Yesterday" | "Earlier";

export function getTimeGroup(timestamp: string): TimeGroup {
	const date = new Date(timestamp);
	const now = new Date();

	const today = new Date(now);
	today.setHours(0, 0, 0, 0);

	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	if (date >= today) return "Today";
	if (date >= yesterday) return "Yesterday";
	return "Earlier";
}

export interface GroupedEntries {
	group: TimeGroup;
	entries: ActivityEntry[];
}

export function groupByTime(entries: ActivityEntry[]): GroupedEntries[] {
	const groups = new Map<TimeGroup, ActivityEntry[]>();

	for (const entry of entries) {
		const group = getTimeGroup(entry.timestamp);
		const list = groups.get(group);
		if (list) {
			list.push(entry);
		} else {
			groups.set(group, [entry]);
		}
	}

	const result: GroupedEntries[] = [];
	const order: TimeGroup[] = ["Today", "Yesterday", "Earlier"];

	for (const group of order) {
		const entries = groups.get(group);
		if (entries && entries.length > 0) {
			result.push({ group, entries });
		}
	}

	return result;
}

export function RecentUpdatesWidget() {
	const { activities, isLoading } = useRecentActivity(50);
	const currentUser = useQuery(api.users.getCurrentUser);
	const userId = currentUser?._id;

	const filtered = useMemo(() => {
		if (!userId) return [];

		return activities
			.filter((entry) => {
				if (entry.actor.id === userId) return false;

				return HIGH_SIGNAL_TYPES.has(entry.type);
			})
			.slice(0, MAX_ITEMS);
	}, [activities, userId]);

	const grouped = useMemo(() => groupByTime(filtered), [filtered]);

	const showLoading = isLoading || currentUser === undefined;

	const rowClass =
		"flex items-start gap-3 rounded px-2 -mx-2 py-2 transition-colors hover:bg-muted/50";

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center gap-2 text-sm font-medium">
					<Inbox className="size-4 text-muted-foreground" />
					Recent Updates
				</CardTitle>
			</CardHeader>
			<CardContent>
				{showLoading ? (
					<div className="space-y-3">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={`skeleton-${i.toString()}`}
								className="flex items-start gap-3 py-2"
							>
								<div className="size-6 animate-pulse rounded-full bg-muted" />
								<div className="flex-1 space-y-1">
									<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
									<div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
								</div>
							</div>
						))}
					</div>
				) : grouped.length === 0 ? (
					<div className="py-8 text-center text-sm text-muted-foreground">
						No recent updates. You're all caught up.
					</div>
				) : (
					<div className="space-y-4">
						{grouped.map(({ group, entries }) => (
							<div key={group}>
								<div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
									{group}
								</div>
								<div>
									{entries.map((entry) => {
										const linkProps = getEntityLink(entry);
										if (linkProps) {
											return (
												<Link
													key={entry.id}
													to={linkProps.to}
													params={linkProps.params}
													className={rowClass}
												>
													<ActivityItemContent
														entry={entry}
														showEntityDetails
														avatarSize="sm"
													/>
												</Link>
											);
										}
										return (
											<div key={entry.id} className={rowClass}>
												<ActivityItemContent
													entry={entry}
													showEntityDetails
													avatarSize="sm"
												/>
											</div>
										);
									})}
								</div>
							</div>
						))}
					</div>
				)}

				<Link
					to="/inbox"
					className="mt-4 flex items-center gap-1 border-t pt-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					View all activity
					<ArrowRight className="size-3" />
				</Link>
			</CardContent>
		</Card>
	);
}
