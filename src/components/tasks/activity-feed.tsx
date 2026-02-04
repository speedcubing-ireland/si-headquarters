import { useActivityForTask } from "@/hooks/use-convex-data";
import type { ActivityEntry } from "@/data/types-new";
import { formatDate, getInitials } from "@/lib/format-utils";
import { Activity } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ActivityFeedProps {
	taskId: string;
}

function getActivityDescription(entry: ActivityEntry): string {
	const { type, oldValue, newValue } = entry;

	switch (type) {
		case "created":
			return "created this task";
		case "status_changed":
			return `changed status from "${oldValue}" to "${newValue}"`;
		case "priority_changed":
			return `changed priority from "${oldValue}" to "${newValue}"`;
		case "assignee_changed":
			if (!oldValue && newValue) {
				return `assigned to ${newValue}`;
			} else if (oldValue && !newValue) {
				return `unassigned from ${oldValue}`;
			} else {
				return `reassigned from ${oldValue} to ${newValue}`;
			}
		case "due_date_changed":
			if (!oldValue && newValue) {
				return `set due date to ${newValue}`;
			} else if (oldValue && !newValue) {
				return `removed due date (${oldValue})`;
			} else {
				return `changed due date from ${oldValue} to ${newValue}`;
			}
		case "label_added":
			return `added label "${newValue}"`;
		case "label_removed":
			return `removed label "${oldValue}"`;
		case "comment_added":
			return "added a comment";
		case "comment_edited":
			return "edited a comment";
		case "comment_deleted":
			return "deleted a comment";
		case "archived":
			return "archived this task";
		case "unarchived":
			return "restored this task from archive";
		default:
			return "made an update";
	}
}

function formatRelativeTime(timestamp: string): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSecs = Math.floor(diffMs / 1000);
	const diffMins = Math.floor(diffSecs / 60);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSecs < 60) {
		return "just now";
	} else if (diffMins < 60) {
		return `${diffMins}m ago`;
	} else if (diffHours < 24) {
		return `${diffHours}h ago`;
	} else if (diffDays < 7) {
		return `${diffDays}d ago`;
	} else {
		return formatDate(timestamp);
	}
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
						title={formatDate(entry.timestamp)}
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
