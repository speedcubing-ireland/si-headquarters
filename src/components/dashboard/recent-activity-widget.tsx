import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTasks, useRecentActivity } from "@/hooks/use-convex-data";
import { getActivityDescription } from "@/lib/activity-utils";
import { getInitials } from "@/lib/format-utils";
import { formatRelativeTime } from "@/lib/activity-utils";

export function RecentActivityWidget() {
	const { activities: activityLog } = useRecentActivity(50);
	const { tasks } = useTasks(false);
	const recentActivity = activityLog.slice(0, 5);

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
							const description = getActivityDescription(entry);
							const content = (
								<>
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
												{description}
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
								</>
							);
							const rowClass =
								"flex items-start gap-3 py-2 border-b last:border-0 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors";

							return entry.entityType === "task" ? (
								<Link
									key={entry.id}
									to="/tasks/$id"
									params={{ id: entry.entityId }}
									className={rowClass}
								>
									{content}
								</Link>
							) : (
								<div key={entry.id} className={rowClass}>
									{content}
								</div>
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
