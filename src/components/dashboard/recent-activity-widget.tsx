import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDataV2 } from "@/data/data-store-v2";
import { formatDate, getInitials } from "@/lib/format-utils";

function formatRelativeTime(timestamp: string): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSecs = Math.floor(diffMs / 1000);
	const diffMins = Math.floor(diffSecs / 60);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSecs < 60) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return formatDate(timestamp);
}

export function RecentActivityWidget() {
	const users = useDataV2((state) => state.users);
	const activityLog = useDataV2((state) => state.activityLog);
	const tasks = useDataV2((state) => state.tasks);

	const currentUser = users[0];

	const recentActivity = useMemo(() => {
		if (!currentUser) return [];

		// Get activity related to current user's tasks or assigned tasks
		const userTaskIds = new Set(
			tasks.filter((t) => t.assignee?.id === currentUser.id).map((t) => t.id),
		);

		return activityLog
			.filter(
				(entry) =>
					(entry.entityType === "task" && userTaskIds.has(entry.entityId)) ||
					entry.actor.id === currentUser.id,
			)
			.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
			.slice(0, 5);
	}, [activityLog, tasks, currentUser]);

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Activity className="size-4 text-muted-foreground" />
					Recent Activity
				</CardTitle>
			</CardHeader>
			<CardContent>
				{recentActivity.length === 0 ? (
					<div className="text-sm text-muted-foreground py-4 text-center">
						No recent activity
					</div>
				) : (
					<div className="space-y-3">
						{recentActivity.map((entry) => {
							const task =
								entry.entityType === "task"
									? tasks.find((t) => t.id === entry.entityId)
									: undefined;

							return (
								<Link
									key={entry.id}
									to="/tasks/$id"
									params={{ id: entry.entityId }}
									className="flex items-start gap-3 py-2 border-b last:border-0 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
								>
									<Avatar className="size-6 shrink-0">
										<AvatarImage src={entry.actor.avatarUrl} />
										<AvatarFallback className="text-[10px]">
											{getInitials(entry.actor.name)}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-1.5">
											<span className="font-medium text-sm">
												{entry.actor.name}
											</span>
											<span className="text-sm text-muted-foreground">
												{entry.type.replace(/_/g, " ")}
											</span>
										</div>
										{task && (
											<div className="text-xs text-muted-foreground mt-0.5 truncate">
												{task.identifier}: {task.title}
											</div>
										)}
										<div className="text-xs text-muted-foreground mt-1">
											{formatRelativeTime(entry.timestamp)}
										</div>
									</div>
								</Link>
							);
						})}
					</div>
				)}

				<Link
					to="/inbox"
					className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-4 pt-3 border-t"
				>
					View inbox
					<ArrowRight className="size-3" />
				</Link>
			</CardContent>
		</Card>
	);
}
