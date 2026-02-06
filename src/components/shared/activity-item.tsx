import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format-utils";
import {
	getActivityDescription,
	formatRelativeTime,
} from "@/lib/activity-utils";
import type { ActivityEntry } from "@/data/types-new";
import { cn } from "@/lib/utils";

interface ActivityItemProps {
	entry: ActivityEntry;
	showEntityDetails?: boolean;
	showCommentPreview?: boolean;
	avatarSize?: "sm" | "md";
	hideAvatar?: boolean;
	className?: string;
	onClick?: () => void;
}

export function ActivityItemContent({
	entry,
	showEntityDetails = false,
	showCommentPreview = false,
	avatarSize = "sm",
	hideAvatar = false,
}: ActivityItemProps) {
	const description = getActivityDescription(entry);
	const timeAgo = formatRelativeTime(entry.timestamp);
	const commentPreview = (entry.metadata as Record<string, unknown> | undefined)
		?.comment as string | undefined;

	return (
		<>
			{!hideAvatar && (
				<Avatar
					className={cn("shrink-0", avatarSize === "sm" ? "size-6" : "size-8")}
				>
					<AvatarImage src={entry.actor.avatarUrl} />
					<AvatarFallback
						className={avatarSize === "sm" ? "text-[10px]" : "text-xs"}
					>
						{getInitials(entry.actor.name)}
					</AvatarFallback>
				</Avatar>
			)}

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

				{showEntityDetails && (
					<div className="mt-1 text-xs text-muted-foreground truncate">
						{entry.entityIdentifier && entry.entityTitle
							? `${entry.entityIdentifier}: ${entry.entityTitle}`
							: `${entry.entityType} · ${entry.type.replace(/_/g, " ")}`}
					</div>
				)}

				{showCommentPreview && commentPreview && (
					<div className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2">
						&quot;{commentPreview}&quot;
					</div>
				)}
			</div>
		</>
	);
}
