import { useActivityForTask } from "@/hooks/use-convex-data";
import { ActivityItemContent } from "@/components/shared/activity-item";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityFeedProps {
	taskId: string;
	className?: string;
}

export function ActivityFeed({ taskId, className }: ActivityFeedProps) {
	const { activities } = useActivityForTask(taskId);

	return (
		<div className={cn("mt-8", className)}>
			<div className="mb-4 flex items-center gap-2">
				<Activity className="size-4 text-muted-foreground" />
				<h3 className="text-sm font-medium">Activity</h3>
				<span className="text-xs text-muted-foreground">
					({activities.length})
				</span>
			</div>

			<div className="space-y-0">
				{activities.length === 0 ? (
					<p className="text-sm text-muted-foreground text-center py-8">
						No activity yet.
					</p>
				) : (
					activities.map((entry) => (
						<div key={entry.id} className="flex gap-2.5 py-3 sm:gap-3">
							<ActivityItemContent
								entry={entry}
								showCommentPreview
								avatarSize="sm"
							/>
						</div>
					))
				)}
			</div>
		</div>
	);
}
