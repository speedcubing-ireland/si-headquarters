import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	Archive,
	Bell,
	Calendar,
	Check,
	CheckCircle2,
	Clock,
	Inbox,
	Link2,
	Mail,
	MessageCircle,
	MoreHorizontal,
	Trash2,
	User,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	useUsers,
	useNotifications,
	useUnreadCount,
	useNotificationMutations,
} from "@/hooks/use-convex-data";
import type { Notification, NotificationType } from "@/data/types-new";
import { formatDate, getInitials } from "@/lib/format-utils";

export const Route = createFileRoute("/inbox")({
	component: RouteComponent,
});

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

function getNotificationIcon(type: NotificationType) {
	switch (type) {
		case "task_assigned":
			return <User className="size-5 text-primary" />;
		case "task_unassigned":
			return <User className="size-5 text-muted-foreground" />;
		case "task_mentioned":
			return <MessageCircle className="size-5 text-primary" />;
		case "task_status_changed":
			return <CheckCircle2 className="size-5 text-primary" />;
		case "due_date_approaching":
			return <Clock className="size-5 text-muted-foreground" />;
		case "due_date_overdue":
			return <AlertCircle className="size-5 text-destructive" />;
		case "comment_added":
			return <MessageCircle className="size-5 text-primary" />;
		case "relation_blocked":
			return <AlertTriangle className="size-5 text-destructive" />;
		case "relation_unblocked":
			return <CheckCircle2 className="size-5 text-primary" />;
		case "competition_phase_changed":
			return <Link2 className="size-5 text-primary" />;
		case "progress_update_added":
			return <Bell className="size-5 text-muted-foreground" />;
		case "reminder_triggered":
			return <Calendar className="size-5 text-primary" />;
		default:
			return <Bell className="size-5 text-muted-foreground" />;
	}
}

function NotificationItem({
	notification,
	onMarkRead,
	onArchive,
	onDismiss,
}: {
	notification: Notification;
	onMarkRead: (id: string) => void;
	onArchive: (id: string) => void;
	onDismiss: (id: string) => void;
}) {
	const isUnread = notification.status === "unread";
	const timeAgo = formatRelativeTime(notification.createdAt);
	const icon = getNotificationIcon(notification.type);

	const getEntityLink = () => {
		switch (notification.entityType) {
			case "task":
				return { to: "/tasks/$id", params: { id: notification.entityId } };
			case "competition":
				return {
					to: "/competitions/$id",
					params: { id: notification.entityId },
				};
			default:
				return null;
		}
	};

	const link = getEntityLink();

	return (
		<div
			className={`flex gap-3 py-3 border-b last:border-b-0 ${
				isUnread ? "border-l-2 border-l-primary pl-3 -ml-[2px]" : ""
			}`}
		>
			{/* Icon */}
			<div className="shrink-0 pt-0.5">{icon}</div>

			{/* Content */}
			<div className="flex-1 min-w-0">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">{notification.title}</span>
							{notification.priority === "urgent" && (
								<Badge variant="destructive" className="text-[10px] h-4">
									Urgent
								</Badge>
							)}
						</div>
						<p className="text-sm text-muted-foreground mt-0.5">
							{notification.message}
						</p>

						{/* Actor info and timestamp */}
						<div className="flex items-center gap-2 mt-2">
							{notification.metadata.actorName && (
								<>
									<Avatar className="size-5">
										<AvatarImage src={notification.metadata.actorAvatarUrl} />
										<AvatarFallback className="text-[8px]">
											{getInitials(notification.metadata.actorName)}
										</AvatarFallback>
									</Avatar>
									<span className="text-sm text-muted-foreground">
										{notification.metadata.actorName}
									</span>
									<span className="text-muted-foreground">·</span>
								</>
							)}
							<span
								className="text-xs text-muted-foreground"
								title={formatDate(notification.createdAt)}
							>
								{timeAgo}
							</span>
						</div>
					</div>

					{/* Actions */}
					<div className="flex items-center gap-1 shrink-0">
						{link && (
							<Button asChild variant="ghost" size="sm" className="h-7 gap-1">
								<Link to={link.to} params={link.params}>
									View
									<Check className="size-3" />
								</Link>
							</Button>
						)}

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="size-7">
									<MoreHorizontal className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{isUnread && (
									<DropdownMenuItem onClick={() => onMarkRead(notification.id)}>
										<Mail className="size-4 mr-2" />
										Mark as read
									</DropdownMenuItem>
								)}
								<DropdownMenuItem onClick={() => onArchive(notification.id)}>
									<Archive className="size-4 mr-2" />
									Archive
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => onDismiss(notification.id)}
									className="text-destructive"
								>
									<Trash2 className="size-4 mr-2" />
									Dismiss
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>
		</div>
	);
}

function RouteComponent() {
	const [activeTab, setActiveTab] = useState("unread");

	const { users } = useUsers();
	const currentUser = users[0];
	const userId = currentUser?.id ?? "";

	const { notifications } = useNotifications(userId || null);
	const unreadCount = useUnreadCount(userId || null);
	const {
		markNotificationRead,
		markNotificationArchived,
		markAllNotificationsRead,
		dismissNotification,
	} = useNotificationMutations();

	const filteredNotifications = useMemo(() => {
		switch (activeTab) {
			case "unread":
				return notifications.filter((n) => n.status === "unread");
			case "read":
				return notifications.filter((n) => n.status === "read");
			case "archived":
				return notifications.filter((n) => n.status === "archived");
			default:
				return notifications;
		}
	}, [notifications, activeTab]);

	const handleMarkRead = (id: string) => {
		void markNotificationRead(id);
	};

	const handleArchive = (id: string) => {
		void markNotificationArchived(id);
	};

	const handleDismiss = (id: string) => {
		void dismissNotification(id);
	};

	const handleMarkAllRead = () => {
		if (userId) void markAllNotificationsRead(userId);
	};

	return (
		<div className="flex flex-1 flex-col">
			<header className="flex h-12 shrink-0 items-center justify-between border-b px-4 lg:px-6">
				<div className="flex items-center gap-2">
					<Inbox className="size-4 text-muted-foreground" />
					<h1 className="text-sm font-semibold">Inbox</h1>
					<Separator orientation="vertical" className="mx-2 h-4 bg-border" />
					<p className="text-xs text-muted-foreground">
						Notifications and updates
					</p>
				</div>
				{(unreadCount ?? 0) > 0 && (
					<Button
						variant="ghost"
						size="sm"
						onClick={handleMarkAllRead}
						className="text-xs"
					>
						<Check className="size-3 mr-1" />
						Mark all read
					</Button>
				)}
			</header>

			<div className="flex-1 p-4 lg:p-6">
				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<TabsList className="mb-4">
						<TabsTrigger value="unread" className="gap-2">
							Unread
							{(unreadCount ?? 0) > 0 && (
								<Badge
									variant="secondary"
									className="text-[10px] h-4 min-w-[18px]"
								>
									{unreadCount ?? 0}
								</Badge>
							)}
						</TabsTrigger>
						<TabsTrigger value="read">Read</TabsTrigger>
						<TabsTrigger value="archived">Archived</TabsTrigger>
						<TabsTrigger value="all">All</TabsTrigger>
					</TabsList>

					<TabsContent value={activeTab} className="mt-0">
						{filteredNotifications.length === 0 ? (
							<div className="text-center py-12">
								<Bell className="size-8 text-muted-foreground/50 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									{activeTab === "unread"
										? "You're all caught up!"
										: activeTab === "archived"
											? "No archived notifications"
											: "No notifications"}
								</p>
							</div>
						) : (
							<div className="space-y-0">
								{filteredNotifications.map((notification) => (
									<NotificationItem
										key={notification.id}
										notification={notification}
										onMarkRead={handleMarkRead}
										onArchive={handleArchive}
										onDismiss={handleDismiss}
									/>
								))}
							</div>
						)}
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
