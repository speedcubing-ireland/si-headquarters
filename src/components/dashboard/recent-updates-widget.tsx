import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Inbox } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Notification } from "@/data/types-new";
import { useNotifications } from "@/hooks/use-convex-data";
import { getNotificationDestination } from "@/lib/notification-destination";
import { getNotificationIconConfig } from "@/lib/notification-ui-catalog";

const MAX_RECENT_NOTIFICATIONS = 3;

function RecentUpdateRow({ notification }: { notification: Notification }) {
	const icon = getNotificationIconConfig(notification.type);
	const destination = getNotificationDestination(notification);
	const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
		addSuffix: true,
	});

	const content = (
		<>
			<div className="flex items-start gap-2">
				<icon.Icon className={`${icon.className} mt-0.5`} />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<p className="truncate text-sm font-medium">{notification.title}</p>
						{notification.status === "unread" ? (
							<span className="size-2 shrink-0 rounded-full bg-primary" />
						) : null}
					</div>
					<p className="line-clamp-1 text-xs text-muted-foreground">
						{notification.message}
					</p>
				</div>
				<span className="shrink-0 text-[11px] text-muted-foreground">
					{timeAgo}
				</span>
			</div>
		</>
	);

	if (!destination) {
		return (
			<Link
				to="/inbox"
				className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
			>
				{content}
			</Link>
		);
	}

	return (
		<Link
			to={destination.to}
			params={destination.params}
			className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
		>
			{content}
		</Link>
	);
}

export function RecentUpdatesWidget() {
	const { notifications, isLoading } = useNotifications();

	const recentNotifications = useMemo(
		() =>
			notifications
				.toSorted(
					(a, b) =>
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
				)
				.slice(0, MAX_RECENT_NOTIFICATIONS),
		[notifications],
	);

	const remainingCount = Math.max(
		notifications.length - recentNotifications.length,
		0,
	);

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center gap-2 text-sm font-medium">
					<Inbox className="size-4 text-muted-foreground" />
					Recent Updates
				</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="space-y-2">
						{Array.from({ length: MAX_RECENT_NOTIFICATIONS }).map((_, i) => (
							<div
								key={`recent-update-skeleton-${i.toString()}`}
								className="h-16 animate-pulse rounded-lg border bg-muted/30"
							/>
						))}
					</div>
				) : recentNotifications.length === 0 ? (
					<div className="py-8 text-center text-sm text-muted-foreground">
						No recent updates
					</div>
				) : (
					<div className="space-y-2">
						{recentNotifications.map((notification) => (
							<RecentUpdateRow
								key={notification.id}
								notification={notification}
							/>
						))}
						{remainingCount > 0 ? (
							<div className="px-1 pt-1">
								<Badge variant="outline">+{remainingCount} more in inbox</Badge>
							</div>
						) : null}
					</div>
				)}
				<Link
					to="/inbox"
					className="mt-4 flex items-center gap-1 border-t pt-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					View inbox
					<ArrowRight className="size-3" />
				</Link>
			</CardContent>
		</Card>
	);
}
