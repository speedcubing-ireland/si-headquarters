import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Archive,
	Bell,
	Calendar,
	Check,
	Clock,
	Inbox,
	Mail,
	MoreHorizontal,
	Settings2,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Id } from "@/convex/_generated/dataModel";
import {
	useNotifications,
	useUnreadCount,
	useNotificationMutations,
	usePendingReminders,
	useReminderMutations,
} from "@/hooks/use-convex-data";
import type { Notification, NotificationType } from "@/data/types-new";
import { formatDate, getInitials } from "@/lib/format-utils";
import { formatDistanceToNow } from "date-fns";
import { onMutationError } from "@/lib/utils";
import { SNOOZE_PRESETS } from "@/lib/reminder-presets";
import { getNotificationIconConfig } from "@/lib/notification-ui-catalog";
import { getNotificationDestination } from "@/lib/notification-destination";

export const Route = createFileRoute("/inbox/")({
	component: RouteComponent,
});

function getNotificationIcon(type: NotificationType) {
	const config = getNotificationIconConfig(type);
	return <config.Icon className={config.className} />;
}

function NotificationItem({
	notification,
	onMarkRead,
	onArchive,
	onDismiss,
	onSnooze,
	onUnsnooze,
}: {
	notification: Notification;
	onMarkRead: (id: Id<"notifications">) => void;
	onArchive: (id: Id<"notifications">) => void;
	onDismiss: (id: Id<"notifications">) => void;
	onSnooze?: (
		notificationId: Id<"notifications">,
		snoozedUntil: string,
	) => void;
	onUnsnooze?: (notificationId: Id<"notifications">) => void;
}) {
	const isUnread = notification.status === "unread";
	const isSnoozed =
		notification.snoozedUntil !== undefined &&
		new Date(notification.snoozedUntil).getTime() > Date.now();
	const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
		addSuffix: true,
	});
	const icon = getNotificationIcon(notification.type);

	const link = getNotificationDestination(notification);

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
							{isSnoozed && (
								<Badge variant="secondary" className="text-[10px] h-4">
									Snoozed
								</Badge>
							)}
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
						{isSnoozed && notification.snoozedUntil && (
							<p className="mt-1 text-xs text-muted-foreground">
								Snoozed until {formatDate(notification.snoozedUntil)}
							</p>
						)}
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
								{isUnread && onSnooze && !isSnoozed && (
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
														onSnooze(notification.id, preset.getRemindAt());
													}}
												>
													{preset.label}
												</DropdownMenuItem>
											))}
										</DropdownMenuSubContent>
									</DropdownMenuSub>
								)}
								{isSnoozed && onUnsnooze && (
									<DropdownMenuItem onClick={() => onUnsnooze(notification.id)}>
										<Clock className="size-4 mr-2" />
										Unsnooze
									</DropdownMenuItem>
								)}
								{isUnread && !isSnoozed && (
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
	const [nowMs, setNowMs] = useState(() => Date.now());

	const { notifications } = useNotifications();
	const unreadCount = useUnreadCount();
	const { reminders } = usePendingReminders();
	const { cancelReminder } = useReminderMutations();
	const {
		markNotificationRead,
		markNotificationArchived,
		markAllNotificationsRead,
		dismissNotification,
		snoozeNotification,
		unsnoozeNotification,
	} = useNotificationMutations();

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setNowMs(Date.now());
		}, 30_000);
		return () => window.clearInterval(intervalId);
	}, []);

	const unreadNotifications = useMemo(
		() =>
			notifications.filter(
				(notification) =>
					notification.status === "unread" &&
					(notification.snoozedUntil === undefined ||
						new Date(notification.snoozedUntil).getTime() <= nowMs),
			),
		[notifications, nowMs],
	);
	const snoozedNotifications = useMemo(
		() =>
			notifications.filter(
				(notification) =>
					notification.status === "unread" &&
					notification.snoozedUntil !== undefined &&
					new Date(notification.snoozedUntil).getTime() > nowMs,
			),
		[notifications, nowMs],
	);
	const readNotifications = useMemo(
		() =>
			notifications.filter((notification) => notification.status === "read"),
		[notifications],
	);
	const archivedNotifications = useMemo(
		() =>
			notifications.filter(
				(notification) => notification.status === "archived",
			),
		[notifications],
	);
	const unreadTotal = unreadCount ?? 0;

	const filteredNotifications = useMemo(() => {
		switch (activeTab) {
			case "unread":
				return unreadNotifications;
			case "snoozed":
				return snoozedNotifications;
			case "read":
				return readNotifications;
			case "archived":
				return archivedNotifications;
			case "all":
				return notifications;
			default:
				return [];
		}
	}, [
		activeTab,
		archivedNotifications,
		notifications,
		readNotifications,
		snoozedNotifications,
		unreadNotifications,
	]);

	const wrapMutation =
		<T extends (...args: never[]) => Promise<undefined | null>>(mutation: T) =>
		(...args: Parameters<T>) => {
			void mutation(...args).catch(onMutationError);
		};

	const notificationTabs = [
		{
			value: "unread",
			items: unreadNotifications,
			emptyIcon: Bell,
			emptyMsg: "You're all caught up!",
		},
		{
			value: "snoozed",
			items: snoozedNotifications,
			emptyIcon: Clock,
			emptyMsg: "No snoozed notifications",
		},
		{
			value: "read",
			items: readNotifications,
			emptyIcon: Bell,
			emptyMsg: "No read notifications",
		},
		{
			value: "archived",
			items: archivedNotifications,
			emptyIcon: Bell,
			emptyMsg: "No archived notifications",
		},
	];

	const handleMarkRead = wrapMutation(markNotificationRead);
	const handleArchive = wrapMutation(markNotificationArchived);
	const handleDismiss = wrapMutation(dismissNotification);
	const handleMarkAllRead = wrapMutation(markAllNotificationsRead);

	const handleSnooze = (
		notificationId: Id<"notifications">,
		snoozedUntil: string,
	) => {
		void snoozeNotification(notificationId, snoozedUntil).catch(
			onMutationError,
		);
	};

	const handleUnsnooze = wrapMutation(unsnoozeNotification);

	return (
		<div className="flex flex-1 flex-col">
			<header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4 lg:h-12 lg:flex-nowrap lg:px-6 lg:py-0">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<SidebarTrigger className="shrink-0" />
					<Separator orientation="vertical" className="hidden h-4 sm:block" />
					<Inbox className="size-4 text-muted-foreground" />
					<h1 className="text-sm font-semibold">Inbox</h1>
					<Separator
						orientation="vertical"
						className="mx-1 hidden h-4 bg-border sm:block"
					/>
					<p className="hidden text-xs text-muted-foreground sm:block">
						Notifications and updates
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button asChild variant="outline" size="sm" className="text-xs">
						<Link to="/inbox/settings">
							<Settings2 className="mr-1 size-3.5" />
							Settings
						</Link>
					</Button>
					{unreadTotal > 0 && (
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
				</div>
			</header>

			<div className="flex-1 p-4 lg:p-6">
				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<TabsList className="mb-4 flex flex-wrap h-auto">
						<TabsTrigger value="unread" className="gap-2">
							Unread
							{unreadTotal > 0 && (
								<Badge
									variant="secondary"
									className="text-[10px] h-4 min-w-[18px]"
								>
									{unreadTotal}
								</Badge>
							)}
						</TabsTrigger>
						<TabsTrigger value="snoozed" className="gap-2">
							Snoozed
							{snoozedNotifications.length > 0 && (
								<Badge
									variant="secondary"
									className="text-[10px] h-4 min-w-[18px]"
								>
									{snoozedNotifications.length}
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

					{notificationTabs.map((tab) => (
						<TabsContent key={tab.value} value={tab.value} className="mt-0">
							{tab.items.length === 0 ? (
								<div className="text-center py-12">
									<tab.emptyIcon className="size-8 text-muted-foreground/50 mx-auto mb-3" />
									<p className="text-sm text-muted-foreground">
										{tab.emptyMsg}
									</p>
								</div>
							) : (
								<div className="space-y-0">
									{tab.items.map((notification) => (
										<NotificationItem
											key={notification.id}
											notification={notification}
											onMarkRead={handleMarkRead}
											onArchive={handleArchive}
											onDismiss={handleDismiss}
											onSnooze={handleSnooze}
											onUnsnooze={handleUnsnooze}
										/>
									))}
								</div>
							)}
						</TabsContent>
					))}
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
						{filteredNotifications.length === 0 ? (
							<div className="text-center py-12">
								<Bell className="size-8 text-muted-foreground/50 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									No notifications
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
										onSnooze={handleSnooze}
										onUnsnooze={handleUnsnooze}
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
