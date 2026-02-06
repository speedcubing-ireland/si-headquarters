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
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Id } from "@/convex/_generated/dataModel";
import { parseTaskId, parseNotificationId } from "@/lib/convex-ids";
import {
	buildOneTimeReminderPayload,
	useNotifications,
	useUnreadCount,
	useNotificationMutations,
	usePendingReminders,
	useReminderMutations,
} from "@/hooks/use-convex-data";
import type { Notification, NotificationType } from "@/data/types-new";
import { formatDate, getInitials } from "@/lib/format-utils";
import { SNOOZE_PRESETS } from "@/lib/reminder-presets";

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
		case "task_awaiting_review":
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
	onSnooze,
}: {
	notification: Notification;
	onMarkRead: (id: Id<"notifications">) => void;
	onArchive: (id: Id<"notifications">) => void;
	onDismiss: (id: Id<"notifications">) => void;
	onSnooze?: (notification: Notification, remindAt: string) => void;
}) {
	const isUnread = notification.status === "unread";
	const timeAgo = formatRelativeTime(notification.createdAt);
	const icon = getNotificationIcon(notification.type as NotificationType);

	const getEntityLink = () => {
		switch (notification.entityType) {
			case "task":
				return { to: "/tasks/$id", params: { id: notification.entityId } };
			case "competition":
				return {
					to: "/competitions/$id",
					params: { id: notification.entityId },
				};
			case "comment":
				return notification.parentEntityId
					? {
							to: "/tasks/$id",
							params: { id: notification.parentEntityId },
						}
					: null;
			case "reminder":
				return notification.parentEntityId
					? { to: "/tasks/$id", params: { id: notification.parentEntityId } }
					: null;
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
			<div className="shrink-0 pt-0.5">{icon}</div>
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
						<div className="flex items-center gap-2 mt-2">
							{notification.metadata?.actorName && (
								<>
									<Avatar className="size-5">
										<AvatarImage src={notification.metadata?.actorAvatarUrl} />
										<AvatarFallback className="text-[8px]">
											{getInitials(notification.metadata?.actorName)}
										</AvatarFallback>
									</Avatar>
									<span className="text-sm text-muted-foreground">
										{notification.metadata?.actorName}
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
								{notification.type === "reminder_triggered" &&
									onSnooze &&
									notification.parentEntityId && (
										<DropdownMenuSub>
											<DropdownMenuSubTrigger>
												<Clock className="size-4 mr-2" />
												Snooze
											</DropdownMenuSubTrigger>
											<DropdownMenuSubContent>
												{SNOOZE_PRESETS.map((preset) => (
													<DropdownMenuItem
														key={preset.key}
														onClick={() => {
															onSnooze(notification, preset.getRemindAt());
														}}
													>
														{preset.label}
													</DropdownMenuItem>
												))}
											</DropdownMenuSubContent>
										</DropdownMenuSub>
									)}
								{isUnread && (
									<DropdownMenuItem
										onClick={() =>
											onMarkRead(
												parseNotificationId(
													notification.id,
												) as Id<"notifications">,
											)
										}
									>
										<Mail className="size-4 mr-2" />
										Mark as read
									</DropdownMenuItem>
								)}
								<DropdownMenuItem
									onClick={() =>
										onArchive(
											parseNotificationId(
												notification.id,
											) as Id<"notifications">,
										)
									}
								>
									<Archive className="size-4 mr-2" />
									Archive
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() =>
										onDismiss(
											parseNotificationId(
												notification.id,
											) as Id<"notifications">,
										)
									}
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

	const { notifications } = useNotifications();
	const unreadCount = useUnreadCount();
	const { reminders } = usePendingReminders();
	const {
		markNotificationRead,
		markNotificationArchived,
		markAllNotificationsRead,
		dismissNotification,
	} = useNotificationMutations();
	const { addReminder, cancelReminder } = useReminderMutations();

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

	const handleMarkRead = (id: Id<"notifications">) => {
		void markNotificationRead(id);
	};

	const handleArchive = (id: Id<"notifications">) => {
		void markNotificationArchived(id);
	};

	const handleDismiss = (id: Id<"notifications">) => {
		void dismissNotification(id);
	};

	const handleMarkAllRead = () => {
		void markAllNotificationsRead();
	};

	const handleSnooze = (notification: Notification, remindAt: string) => {
		if (
			notification.type !== "reminder_triggered" ||
			!notification.parentEntityId
		)
			return;
		const taskId = parseTaskId(notification.parentEntityId);
		if (!taskId) return;
		void addReminder(buildOneTimeReminderPayload(taskId, remindAt));
		void markNotificationRead(
			parseNotificationId(notification.id) as Id<"notifications">,
		);
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
						<TabsTrigger value="reminders" className="gap-2">
							Reminders
							{reminders.length > 0 && (
								<Badge
									variant="secondary"
									className="text-[10px] h-4 min-w-[18px]"
								>
									{reminders.length}
								</Badge>
							)}
						</TabsTrigger>
						<TabsTrigger value="all">All</TabsTrigger>
					</TabsList>

					<TabsContent value="unread" className="mt-0">
						{filteredNotifications.length === 0 ? (
							<div className="text-center py-12">
								<Bell className="size-8 text-muted-foreground/50 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									You&apos;re all caught up!
								</p>
							</div>
						) : (
							<div className="space-y-0">
								{notifications
									.filter((n) => n.status === "unread")
									.map((notification) => (
										<NotificationItem
											key={notification.id}
											notification={notification}
											onMarkRead={handleMarkRead}
											onArchive={handleArchive}
											onDismiss={handleDismiss}
											onSnooze={handleSnooze}
										/>
									))}
							</div>
						)}
					</TabsContent>
					<TabsContent value="read" className="mt-0">
						{notifications.filter((n) => n.status === "read").length === 0 ? (
							<div className="text-center py-12">
								<Bell className="size-8 text-muted-foreground/50 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									No read notifications
								</p>
							</div>
						) : (
							<div className="space-y-0">
								{notifications
									.filter((n) => n.status === "read")
									.map((notification) => (
										<NotificationItem
											key={notification.id}
											notification={notification}
											onMarkRead={handleMarkRead}
											onArchive={handleArchive}
											onDismiss={handleDismiss}
											onSnooze={handleSnooze}
										/>
									))}
							</div>
						)}
					</TabsContent>
					<TabsContent value="archived" className="mt-0">
						{notifications.filter((n) => n.status === "archived").length ===
						0 ? (
							<div className="text-center py-12">
								<Bell className="size-8 text-muted-foreground/50 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									No archived notifications
								</p>
							</div>
						) : (
							<div className="space-y-0">
								{notifications
									.filter((n) => n.status === "archived")
									.map((notification) => (
										<NotificationItem
											key={notification.id}
											notification={notification}
											onMarkRead={handleMarkRead}
											onArchive={handleArchive}
											onDismiss={handleDismiss}
											onSnooze={handleSnooze}
										/>
									))}
							</div>
						)}
					</TabsContent>
					<TabsContent value="reminders" className="mt-0">
						{reminders.length === 0 ? (
							<div className="text-center py-12">
								<Calendar className="size-8 text-muted-foreground/50 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									No upcoming reminders
								</p>
							</div>
						) : (
							<div className="space-y-0">
								{reminders.map((reminder) => (
									<div
										key={reminder.id}
										className="flex items-center gap-3 py-3 border-b last:border-b-0"
									>
										<Calendar className="size-5 shrink-0 text-primary" />
										<div className="flex-1 min-w-0">
											<Link
												to="/tasks/$id"
												params={{ id: reminder.entityId }}
												className="font-medium text-sm hover:underline"
											>
												Task reminder
											</Link>
											<p className="text-xs text-muted-foreground mt-0.5">
												{formatDate(reminder.remindAt)}
											</p>
										</div>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 text-xs"
											onClick={() => cancelReminder(reminder.id)}
										>
											Cancel
										</Button>
									</div>
								))}
							</div>
						)}
					</TabsContent>
					<TabsContent value="all" className="mt-0">
						{notifications.length === 0 ? (
							<div className="text-center py-12">
								<Bell className="size-8 text-muted-foreground/50 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									No notifications
								</p>
							</div>
						) : (
							<div className="space-y-0">
								{notifications.map((notification) => (
									<NotificationItem
										key={notification.id}
										notification={notification}
										onMarkRead={handleMarkRead}
										onArchive={handleArchive}
										onDismiss={handleDismiss}
										onSnooze={handleSnooze}
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
