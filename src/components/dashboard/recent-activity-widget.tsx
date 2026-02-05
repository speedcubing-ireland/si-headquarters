import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecentActivity } from "@/hooks/use-convex-data";
import { ActivityItemContent } from "@/components/shared/activity-item";
import { getEntityLink } from "@/lib/activity-utils";

export function RecentActivityWidget() {
	const { activities: activityLog } = useRecentActivity(50);
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
							const linkProps = getEntityLink(entry);
							const rowClass =
								"flex items-start gap-3 py-2 border-b last:border-0 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors";

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
