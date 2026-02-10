import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Settings2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import {
	useNotificationSettings,
	useNotificationSubscriptions,
	useNotificationMutations,
} from "@/hooks/use-convex-data";
import type {
	NotificationPreference,
	NotificationType,
} from "@/data/types-new";
import { onMutationError } from "@/lib/utils";
import {
	NOTIFICATION_TYPE_OPTIONS,
	DIGEST_OPTIONS,
	minutesToTimeInput,
	timeInputToMinutes,
} from "@/lib/notification-utils";

const getNotificationTypeLabel = (type: NotificationType) =>
	NOTIFICATION_TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type;

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
	const label = getNotificationTypeLabel(preference.type);

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

export function InboxSettingsPanel() {
	const [timezoneInput, setTimezoneInput] = useState("Europe/Dublin");
	const [quietStartInput, setQuietStartInput] = useState("");
	const [quietEndInput, setQuietEndInput] = useState("");

	const {
		preferences,
		timezone,
		defaultDigestMode,
		quietHoursStartMin,
		quietHoursEndMin,
	} = useNotificationSettings();
	const { subscriptions } = useNotificationSubscriptions();
	const {
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

	const globalQuietStartMin = timeInputToMinutes(quietStartInput);
	const globalQuietEndMin = timeInputToMinutes(quietEndInput);
	const globalQuietHoursValid =
		(quietStartInput === "" && quietEndInput === "") ||
		(globalQuietStartMin !== undefined && globalQuietEndMin !== undefined);

	const sortedPreferences = useMemo(() => {
		const typeOrder = new Map(
			NOTIFICATION_TYPE_OPTIONS.map((option, index) => [option.value, index]),
		);
		const sorted = [...preferences].sort(
			(a, b) => (typeOrder.get(a.type) ?? 0) - (typeOrder.get(b.type) ?? 0),
		);
		return {
			inApp: sorted.filter((p) => p.channel === "in_app"),
			email: sorted.filter((p) => p.channel === "email"),
		};
	}, [preferences]);

	const inAppPreferences = sortedPreferences.inApp;
	const emailPreferences = sortedPreferences.email;

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
										defaultDigestMode === option.value ? "secondary" : "outline"
									}
									className="h-9 justify-start text-xs"
									onClick={() => handleSetDefaultDigestMode(option.value)}
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
								<p className="mb-1 text-xs text-muted-foreground">Start</p>
								<Input
									type="time"
									value={quietStartInput}
									onChange={(event) => setQuietStartInput(event.target.value)}
									className="h-8"
								/>
							</div>
							<div>
								<p className="mb-1 text-xs text-muted-foreground">End</p>
								<Input
									type="time"
									value={quietEndInput}
									onChange={(event) => setQuietEndInput(event.target.value)}
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
								onChange={(event) => setTimezoneInput(event.target.value)}
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
						<p className="text-xs text-muted-foreground">Current: {timezone}</p>
					</div>
				</div>
			</div>

			<div className="rounded-xl border border-border/70 p-4 sm:p-5">
				<div className="mb-4 flex items-center gap-2">
					<div className="rounded-md border border-border/70 bg-background/80 p-1.5">
						<Mail className="size-4 text-primary" />
					</div>
					<div>
						<p className="text-sm font-semibold">Email notifications</p>
						<p className="text-xs text-muted-foreground">
							Opt in to receive email for specific notification types. All email
							notifications are off by default.
						</p>
					</div>
				</div>
				<div className="space-y-2">
					{emailPreferences.map((preference) => {
						const label = getNotificationTypeLabel(preference.type);
						return (
							<div
								key={`${preference.type}:${preference.channel}`}
								className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/60 p-3"
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">{label}</p>
									<p className="text-xs text-muted-foreground">
										{preference.enabled
											? "You will receive emails for this type"
											: "Email disabled"}
									</p>
								</div>
								<Button
									variant={preference.enabled ? "secondary" : "outline"}
									size="sm"
									onClick={() =>
										handlePreferenceSave({
											type: preference.type,
											channel: "email",
											enabled: !preference.enabled,
										})
									}
								>
									{preference.enabled ? "On" : "Off"}
								</Button>
							</div>
						);
					})}
				</div>
			</div>

			<div className="rounded-xl border border-border/70 p-4 sm:p-5">
				<div className="mb-4">
					<p className="text-sm font-semibold">In-app per-type overrides</p>
					<p className="text-xs text-muted-foreground">
						Override global mode for specific in-app notification types.
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
											<Badge variant="outline" className="h-5 text-[10px]">
												Stale
											</Badge>
										)}
									</div>
									<p className="text-xs text-muted-foreground">
										{subscription.description ?? subscription.subscriptionType}
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
	);
}
