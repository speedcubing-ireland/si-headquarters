import { useActivityForTask } from "@/hooks/use-convex-data";
import type { ActivityEntry } from "@/data/types-new";
import { getInitials } from "@/lib/format-utils";
import {
	getActivityDescription,
	formatRelativeTime,
} from "@/lib/activity-utils";
import { Activity } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ActivityFeedProps {
	taskId: string;
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
	const description = getActivityDescription(entry);
	const timeAgo = formatRelativeTime(entry.timestamp);
	const commentPreview = entry.metadata?.comment as string | undefined;

	return (
		<div className="flex gap-3 py-3">
			<div className="flex flex-col items-center">
				<Avatar className="size-6 shrink-0">
					<AvatarImage src={entry.actor.avatarUrl} />
					<AvatarFallback className="text-[10px]">
						{getInitials(entry.actor.name)}
					</AvatarFallback>
				</Avatar>
				<div className="w-px flex-1 bg-border mt-2" />
			</div>

			<div className="flex-1 min-w-0 pb-3">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1">
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

				{commentPreview && (
					<div className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2">
						&quot;{commentPreview}&quot;
					</div>
				)}
			</div>
		</div>
	);
}

export function ActivityFeed({ taskId }: ActivityFeedProps) {
	const { activities } = useActivityForTask(taskId);

	return (
		<div className="mt-8">
			<div className="flex items-center gap-2 mb-4">
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
						<ActivityItem key={entry.id} entry={entry} />
					))
				)}
			</div>
		</div>
	);
}
