import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	Archive,
	Bell,
	BookMarked,
	Calendar,
	Check,
	CheckCircle2,
	Clock,
	Inbox,
	Link2,
	Mail,
	MessageCircle,
	MoreHorizontal,
	Settings2,
	Trash2,
	User,
	XCircle,
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Id } from "@/convex/_generated/dataModel";
import {
	useNotifications,
	useNotificationSettings,
	useNotificationSubscriptions,
	useUnreadCount,
	useNotificationMutations,
	usePendingReminders,
	useReminderMutations,
} from "@/hooks/use-convex-data";
import type {
	Notification,
	NotificationPreference,
	NotificationType,
} from "@/data/types-new";
import { formatDate, getInitials } from "@/lib/format-utils";
import { formatRelativeTime } from "@/lib/activity-utils";
import { onMutationError } from "@/lib/utils";
import { SNOOZE_PRESETS } from "@/lib/reminder-presets";
import {
	NOTIFICATION_TYPE_OPTIONS,
	DIGEST_OPTIONS,
	minutesToTimeInput,
	timeInputToMinutes,
} from "@/lib/notification-utils";

export const Route = createFileRoute("/inbox")({
	component: RouteComponent,
});

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
		case "task_priority_changed":
			return <AlertTriangle className="size-5 text-warning" />;
		case "task_awaiting_review":
			return <CheckCircle2 className="size-5 text-primary" />;
		case "due_date_approaching":
			return <Clock className="size-5 text-muted-foreground" />;
		case "due_date_overdue":
			return <AlertCircle className="size-5 text-destructive" />;
		case "comment_added":
			return <MessageCircle className="size-5 text-primary" />;
		case "comment_replied":
			return <MessageCircle className="size-5 text-primary" />;
		case "relation_blocked":
			return <AlertTriangle className="size-5 text-destructive" />;
		case "relation_unblocked":
			return <CheckCircle2 className="size-5 text-primary" />;
		case "task_approved":
			return <CheckCircle2 className="size-5 text-primary" />;
		case "task_unapproved":
			return <XCircle className="size-5 text-muted-foreground" />;
		case "due_date_changed":
			return <Calendar className="size-5 text-primary" />;
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

function NotificationTypeOverrideRow({
	preference,
	onSave,
}: {
	preference: NotificationPreference;
	onSave: (payload: {
		type: NotificationType;
		channel: NotificationPreference["channel"];
		enabled?: boolean;
		respectQuietHours?: boolean;
		clearOverride?: boolean;
	}) => void;
}) {
	const label =
		NOTIFICATION_TYPE_OPTIONS.find((option) => option.value === preference.type)
			?.label ?? preference.type;

	return (
		<div className="rounded-lg border border-border/70 bg-background/60 p-3">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{label}</p>
					<p className="text-xs text-muted-foreground">
						{preference.isOverride
							? "Override active"
							: "Using global delivery defaults"}
					</p>
				</div>
				<Badge variant={preference.isOverride ? "secondary" : "outline"}>
					{preference.isOverride ? "Override" : "Global"}
				</Badge>
			</div>

			{preference.isOverride ? (
				<div className="mt-3 grid gap-3 sm:grid-cols-[auto,auto,1fr] sm:items-end">
					<div className="flex items-center gap-2">
						<Button
							variant={preference.enabled ? "secondary" : "outline"}
							size="sm"
							onClick={() =>
								onSave({
									type: preference.type,
									channel: preference.channel,
									enabled: !preference.enabled,
								})
							}
						>
							{preference.enabled ? "Enabled" : "Disabled"}
						</Button>
					</div>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">Mode</p>
						<Badge variant="secondary" className="h-8 px-3 text-xs">
							Immediate
						</Badge>
					</div>
					<div>
						<p className="mb-1 text-xs text-muted-foreground">Quiet hours</p>
						<Button
							variant={preference.respectQuietHours ? "secondary" : "outline"}
							size="sm"
							onClick={() =>
								onSave({
									type: preference.type,
									channel: preference.channel,
									respectQuietHours: !preference.respectQuietHours,
								})
							}
						>
							{preference.respectQuietHours
								? "Respect quiet hours"
								: "Ignore quiet hours"}
						</Button>
					</div>
				</div>
			) : null}

			<div className="mt-3">
				{preference.isOverride ? (
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={() =>
							onSave({
								type: preference.type,
								channel: preference.channel,
								clearOverride: true,
							})
						}
					>
						Reset to global
					</Button>
				) : (
					<Button
						variant="outline"
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={() =>
							onSave({
								type: preference.type,
								channel: preference.channel,
								enabled: preference.enabled,
								respectQuietHours: true,
							})
						}
					>
						Add override
					</Button>
				)}
			</div>
		</div>
	);
}

function RouteComponent() {
	const [activeTab, setActiveTab] = useState("unread");
	const [timezoneInput, setTimezoneInput] = useState("Europe/Dublin");
	const [quietStartInput, setQuietStartInput] = useState("");
	const [quietEndInput, setQuietEndInput] = useState("");
	const [nowMs, setNowMs] = useState(() => Date.now());

	const { notifications } = useNotifications();
	const unreadCount = useUnreadCount();
	const { reminders } = usePendingReminders();
	const { cancelReminder } = useReminderMutations();
	const {
		preferences,
		timezone,
		defaultDigestMode,
		quietHoursStartMin,
		quietHoursEndMin,
	} = useNotificationSettings();
	const { subscriptions } = useNotificationSubscriptions();
	const {
		markNotificationRead,
		markNotificationArchived,
		markAllNotificationsRead,
		dismissNotification,
		snoozeNotification,
		unsnoozeNotification,
		upsertNotificationPreference,
		upsertNotificationUserSettings,
		unsubscribeNotificationSubscription,
	} = useNotificationMutations();

	useEffect(() => {
		setTimezoneInput(timezone);
	}, [timezone]);

	useEffect(() => {
		setQuietStartInput(minutesToTimeInput(quietHoursStartMin));
		setQuietEndInput(minutesToTimeInput(quietHoursEndMin));
	}, [quietHoursEndMin, quietHoursStartMin]);

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setNowMs(Date.now());
		}, 30_000);
		return () => window.clearInterval(intervalId);
	}, []);

	const globalQuietStartMin = timeInputToMinutes(quietStartInput);
	const globalQuietEndMin = timeInputToMinutes(quietEndInput);
	const globalQuietHoursValid =
		(quietStartInput === "" && quietEndInput === "") ||
		(globalQuietStartMin !== undefined && globalQuietEndMin !== undefined);

	const inAppPreferences = useMemo(() => {
		const typeOrder = new Map(
			NOTIFICATION_TYPE_OPTIONS.map((option, index) => [option.value, index]),
		);
		return preferences
			.filter((preference) => preference.channel === "in_app")
			.sort(
				(a, b) => (typeOrder.get(a.type) ?? 0) - (typeOrder.get(b.type) ?? 0),
			);
	}, [preferences]);

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

	const handleMarkRead = (id: Id<"notifications">) => {
		void markNotificationRead(id).catch(onMutationError);
	};

	const handleArchive = (id: Id<"notifications">) => {
		void markNotificationArchived(id).catch(onMutationError);
	};

	const handleDismiss = (id: Id<"notifications">) => {
		void dismissNotification(id).catch(onMutationError);
	};

	const handleMarkAllRead = () => {
		void markAllNotificationsRead().catch(onMutationError);
	};

	const handleSnooze = (
		notificationId: Id<"notifications">,
		snoozedUntil: string,
	) => {
		void snoozeNotification(notificationId, snoozedUntil).catch(
			onMutationError,
		);
	};

	const handleUnsnooze = (notificationId: Id<"notifications">) => {
		void unsnoozeNotification(notificationId).catch(onMutationError);
	};

	const handlePreferenceSave = (payload: {
		type: NotificationType;
		channel: NotificationPreference["channel"];
		enabled?: boolean;
		respectQuietHours?: boolean;
		clearOverride?: boolean;
	}) => {
		void upsertNotificationPreference({
			type: payload.type,
			channel: payload.channel,
			enabled: payload.enabled,
			respectQuietHours: payload.respectQuietHours,
			clearOverride: payload.clearOverride,
		}).catch(onMutationError);
	};

	const handleSaveTimezone = () => {
		const trimmed = timezoneInput.trim();
		if (!trimmed) {
			return;
		}
		void upsertNotificationUserSettings({ timezone: trimmed }).catch(
			onMutationError,
		);
	};

	const handleSetDefaultDigestMode = (
		digestMode: NotificationPreference["digestMode"],
	) => {
		void upsertNotificationUserSettings({
			defaultDigestMode: digestMode,
		}).catch(onMutationError);
	};

	const handleSaveGlobalQuietHours = () => {
		if (
			globalQuietStartMin === undefined ||
			globalQuietEndMin === undefined ||
			!globalQuietHoursValid
		) {
			return;
		}
		void upsertNotificationUserSettings({
			quietHoursStartMin: globalQuietStartMin,
			quietHoursEndMin: globalQuietEndMin,
		}).catch(onMutationError);
	};

	const handleClearGlobalQuietHours = () => {
		setQuietStartInput("");
		setQuietEndInput("");
		void upsertNotificationUserSettings({ clearQuietHours: true }).catch(
			onMutationError,
		);
	};

	const handleUnsubscribe = (
		subscriptionId: Id<"notificationSubscriptions">,
	) => {
		void unsubscribeNotificationSubscription(subscriptionId).catch(
			onMutationError,
		);
	};

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
						<TabsTrigger value="settings" className="gap-2">
							<BookMarked className="size-3.5" />
							Settings
						</TabsTrigger>
						<TabsTrigger value="all">All</TabsTrigger>
					</TabsList>

					<TabsContent value="unread" className="mt-0">
						{unreadNotifications.length === 0 ? (
							<div className="text-center py-12">
								<Bell className="size-8 text-muted-foreground/50 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									You&apos;re all caught up!
								</p>
							</div>
						) : (
							<div className="space-y-0">
								{unreadNotifications.map((notification) => (
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
					<TabsContent value="snoozed" className="mt-0">
						{snoozedNotifications.length === 0 ? (
							<div className="text-center py-12">
								<Clock className="size-8 text-muted-foreground/50 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									No snoozed notifications
								</p>
							</div>
						) : (
							<div className="space-y-0">
								{snoozedNotifications.map((notification) => (
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
					<TabsContent value="read" className="mt-0">
						{readNotifications.length === 0 ? (
							<div className="text-center py-12">
								<Bell className="size-8 text-muted-foreground/50 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									No read notifications
								</p>
							</div>
						) : (
							<div className="space-y-0">
								{readNotifications.map((notification) => (
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
					<TabsContent value="archived" className="mt-0">
						{archivedNotifications.length === 0 ? (
							<div className="text-center py-12">
								<Bell className="size-8 text-muted-foreground/50 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									No archived notifications
								</p>
							</div>
						) : (
							<div className="space-y-0">
								{archivedNotifications.map((notification) => (
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
					<TabsContent value="settings" className="mt-0">
						<div className="space-y-5">
							<div className="rounded-xl border border-border/70 bg-gradient-to-br from-background to-muted/30 p-4 sm:p-5">
								<div className="mb-4 flex items-center gap-2">
									<div className="rounded-md border border-border/70 bg-background/80 p-1.5">
										<Settings2 className="size-4 text-primary" />
									</div>
									<div>
										<p className="text-sm font-semibold">Default delivery</p>
										<p className="text-xs text-muted-foreground">
											Applies to all in-app notifications unless overridden.
										</p>
									</div>
								</div>

								<div className="space-y-4">
									<div className="space-y-2">
										<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
											Delivery mode
										</p>
										<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
											{DIGEST_OPTIONS.map((option) => (
												<Button
													key={option.value}
													type="button"
													variant={
														defaultDigestMode === option.value
															? "secondary"
															: "outline"
													}
													className="h-9 justify-start text-xs"
													onClick={() =>
														handleSetDefaultDigestMode(option.value)
													}
												>
													{option.label}
												</Button>
											))}
										</div>
									</div>

									<div className="space-y-2">
										<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
											Quiet hours
										</p>
										<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto,auto] sm:items-end">
											<div>
												<p className="mb-1 text-xs text-muted-foreground">
													Start
												</p>
												<Input
													type="time"
													value={quietStartInput}
													onChange={(event) =>
														setQuietStartInput(event.target.value)
													}
													className="h-8"
												/>
											</div>
											<div>
												<p className="mb-1 text-xs text-muted-foreground">
													End
												</p>
												<Input
													type="time"
													value={quietEndInput}
													onChange={(event) =>
														setQuietEndInput(event.target.value)
													}
													className="h-8"
												/>
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={!globalQuietHoursValid}
												onClick={handleSaveGlobalQuietHours}
											>
												Save
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={handleClearGlobalQuietHours}
											>
												Clear
											</Button>
										</div>
										{!globalQuietHoursValid ? (
											<p className="text-xs text-destructive">
												Set both start and end times.
											</p>
										) : null}
									</div>

									<div className="space-y-2">
										<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
											Timezone
										</p>
										<div className="flex flex-wrap items-center gap-2">
											<Input
												value={timezoneInput}
												onChange={(event) =>
													setTimezoneInput(event.target.value)
												}
												className="max-w-[260px]"
												placeholder="Europe/Dublin"
											/>
											<Button size="sm" onClick={handleSaveTimezone}>
												Save timezone
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setTimezoneInput("Europe/Dublin")}
											>
												Set Irish time
											</Button>
										</div>
										<p className="text-xs text-muted-foreground">
											Current: {timezone}
										</p>
									</div>
								</div>
							</div>

							<div className="rounded-xl border border-border/70 p-4 sm:p-5">
								<div className="mb-4">
									<p className="text-sm font-semibold">Per-type overrides</p>
									<p className="text-xs text-muted-foreground">
										Override global mode for specific notification types.
									</p>
								</div>
								<div className="space-y-2">
									{inAppPreferences.map((preference) => (
										<NotificationTypeOverrideRow
											key={`${preference.type}:${preference.channel}`}
											preference={preference}
											onSave={handlePreferenceSave}
										/>
									))}
								</div>
							</div>

							<div className="rounded-md border p-4 space-y-3">
								<div>
									<p className="text-sm font-medium">Active subscriptions</p>
									<p className="text-xs text-muted-foreground">
										Entity and saved-view subscriptions that can add recipients.
									</p>
								</div>
								{subscriptions.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										No active subscriptions.
									</p>
								) : (
									<div className="space-y-2">
										{subscriptions.map((subscription) => (
											<div
												key={subscription.id}
												className="flex items-center justify-between gap-3 rounded border px-3 py-2"
											>
												<div className="min-w-0">
													<div className="flex items-center gap-2">
														<p className="truncate text-sm font-medium">
															{subscription.label}
														</p>
														{subscription.isStale && (
															<Badge
																variant="outline"
																className="h-5 text-[10px]"
															>
																Stale
															</Badge>
														)}
													</div>
													<p className="text-xs text-muted-foreground">
														{subscription.description ??
															subscription.subscriptionType}
													</p>
												</div>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleUnsubscribe(subscription.id)}
												>
													Unsubscribe
												</Button>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
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
