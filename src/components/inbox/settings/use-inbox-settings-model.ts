import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type {
	NotificationPreference,
	NotificationType,
} from "@/data/types-new";
import {
	useNotificationMutations,
	useNotificationSettings,
	useNotificationSubscriptions,
} from "@/hooks/use-convex-data";
import {
	minutesToTimeInput,
	timeInputToMinutes,
} from "@/lib/notification-utils";
import {
	buildPreferenceRows,
	deriveEmailBulkState,
	deriveSubscriptionBulkState,
	filterPreferenceRows,
	filterSubscriptions,
	getPreferenceSaveKey,
	getSubscriptionSaveKey,
	type PreferenceRowViewModel,
	type SettingSaveState,
	type SubscriptionFilter,
} from "@/lib/notification-settings-view-model";
import { onMutationError } from "@/lib/utils";

const SAVE_RESET_DELAY_MS = 1400;
const ERROR_RESET_DELAY_MS = 2600;

const DEFAULT_DIGEST_SAVE_KEY = "settings:default-digest";
const TIMEZONE_SAVE_KEY = "settings:timezone";
const QUIET_HOURS_SAVE_KEY = "settings:quiet-hours";
const EMAIL_BULK_SAVE_KEY = "settings:email-bulk";
const SUBSCRIPTIONS_BULK_SAVE_KEY = "settings:subscriptions-bulk";
const DEFAULT_QUIET_HOURS_START_MIN = 22 * 60;
const DEFAULT_QUIET_HOURS_END_MIN = 7 * 60;

export {
	getPreferenceSaveKey,
	getSubscriptionSaveKey,
	type SettingSaveState,
	type PreferenceRowViewModel,
};

export function useInboxSettingsModel() {
	const [timezoneInput, setTimezoneInput] = useState("Europe/Dublin");
	const [quietStartInput, setQuietStartInput] = useState("");
	const [quietEndInput, setQuietEndInput] = useState("");
	const [emailQuery, setEmailQuery] = useState("");
	const [overrideQuery, setOverrideQuery] = useState("");
	const [subscriptionQuery, setSubscriptionQuery] = useState("");
	const [subscriptionFilter, setSubscriptionFilter] =
		useState<SubscriptionFilter>("all");
	const [saveStates, setSaveStates] = useState<
		Record<string, SettingSaveState>
	>({});
	const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

	const saveTimersRef = useRef<Record<string, number>>({});

	const {
		preferences,
		timezone,
		defaultDigestMode,
		quietHoursStartMin,
		quietHoursEndMin,
		isLoading: isSettingsLoading,
	} = useNotificationSettings();
	const { subscriptions, isLoading: isSubscriptionsLoading } =
		useNotificationSubscriptions();
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

	useEffect(
		() => () => {
			Object.values(saveTimersRef.current).forEach((timerId) => {
				window.clearTimeout(timerId);
			});
		},
		[],
	);

	const setSaveState = useCallback((key: string, state: SettingSaveState) => {
		setSaveStates((current) => {
			if (current[key] === state) {
				return current;
			}
			return { ...current, [key]: state };
		});
	}, []);

	const scheduleReset = useCallback(
		(key: string, delayMs: number) => {
			const timerId = saveTimersRef.current[key];
			if (timerId) {
				window.clearTimeout(timerId);
			}
			saveTimersRef.current[key] = window.setTimeout(() => {
				setSaveState(key, "idle");
			}, delayMs);
		},
		[setSaveState],
	);

	const runSave = useCallback(
		async <T>(
			key: string,
			action: () => Promise<T>,
			options?: { toastOnError?: boolean },
		): Promise<boolean> => {
			setSaveState(key, "saving");
			try {
				await action();
				setSaveState(key, "saved");
				scheduleReset(key, SAVE_RESET_DELAY_MS);
				setLastSavedAt(new Date());
				return true;
			} catch (error) {
				setSaveState(key, "error");
				scheduleReset(key, ERROR_RESET_DELAY_MS);
				if (options?.toastOnError ?? true) {
					onMutationError(error);
				}
				return false;
			}
		},
		[scheduleReset, setSaveState],
	);

	const getSaveState = useCallback(
		(key: string) => saveStates[key] ?? "idle",
		[saveStates],
	);

	const { emailRows, inAppRows } = useMemo(
		() => buildPreferenceRows(preferences, getSaveState),
		[preferences, getSaveState],
	);

	const filteredEmailRows = useMemo(
		() => filterPreferenceRows(emailRows, emailQuery),
		[emailQuery, emailRows],
	);
	const filteredInAppRows = useMemo(
		() => filterPreferenceRows(inAppRows, overrideQuery),
		[inAppRows, overrideQuery],
	);

	const filteredSubscriptions = useMemo(
		() =>
			filterSubscriptions(subscriptions, subscriptionFilter, subscriptionQuery),
		[subscriptionFilter, subscriptionQuery, subscriptions],
	);

	const emailBulkState = useMemo(
		() => deriveEmailBulkState(filteredEmailRows),
		[filteredEmailRows],
	);
	const subscriptionsBulkState = useMemo(
		() => deriveSubscriptionBulkState(filteredSubscriptions),
		[filteredSubscriptions],
	);

	const quietStartMin = timeInputToMinutes(quietStartInput);
	const quietEndMin = timeInputToMinutes(quietEndInput);
	const isQuietHoursBlank = quietStartInput === "" && quietEndInput === "";
	const isQuietHoursEnabled = !isQuietHoursBlank;
	const areQuietHoursValid =
		isQuietHoursBlank ||
		(quietStartMin !== undefined && quietEndMin !== undefined);
	const quietHoursSummary =
		isQuietHoursEnabled && areQuietHoursValid
			? `${quietStartInput} to ${quietEndInput} (${timezone})`
			: null;

	const savePreference = useCallback(
		(payload: {
			type: NotificationType;
			channel: NotificationPreference["channel"];
			enabled?: boolean;
			respectQuietHours?: boolean;
			clearOverride?: boolean;
		}) =>
			runSave(getPreferenceSaveKey(payload.type, payload.channel), () =>
				upsertNotificationPreference(payload),
			),
		[runSave, upsertNotificationPreference],
	);

	const setDefaultDigestMode = useCallback(
		(digestMode: NotificationPreference["digestMode"]) => {
			if (digestMode === defaultDigestMode) {
				return;
			}
			void runSave(DEFAULT_DIGEST_SAVE_KEY, () =>
				upsertNotificationUserSettings({ defaultDigestMode: digestMode }),
			);
		},
		[defaultDigestMode, runSave, upsertNotificationUserSettings],
	);

	const commitTimezone = useCallback(
		(value?: string) => {
			const trimmed = (value ?? timezoneInput).trim();
			if (!trimmed || trimmed === timezone) {
				setTimezoneInput(trimmed || timezone);
				return;
			}
			setTimezoneInput(trimmed);
			void runSave(TIMEZONE_SAVE_KEY, () =>
				upsertNotificationUserSettings({ timezone: trimmed }),
			);
		},
		[runSave, timezone, timezoneInput, upsertNotificationUserSettings],
	);

	const saveQuietHoursRange = useCallback(
		(startMin: number, endMin: number) => {
			if (
				startMin === quietHoursStartMin &&
				endMin === quietHoursEndMin &&
				!isQuietHoursBlank
			) {
				return;
			}
			void runSave(QUIET_HOURS_SAVE_KEY, () =>
				upsertNotificationUserSettings({
					quietHoursStartMin: startMin,
					quietHoursEndMin: endMin,
				}),
			);
		},
		[
			isQuietHoursBlank,
			quietHoursEndMin,
			quietHoursStartMin,
			runSave,
			upsertNotificationUserSettings,
		],
	);

	const commitQuietHours = useCallback(() => {
		if (
			!areQuietHoursValid ||
			quietStartMin === undefined ||
			quietEndMin === undefined
		) {
			return;
		}
		saveQuietHoursRange(quietStartMin, quietEndMin);
	}, [areQuietHoursValid, quietEndMin, quietStartMin, saveQuietHoursRange]);

	const clearQuietHours = useCallback(() => {
		setQuietStartInput("");
		setQuietEndInput("");
		if (quietHoursStartMin === undefined && quietHoursEndMin === undefined) {
			return;
		}
		void runSave(QUIET_HOURS_SAVE_KEY, () =>
			upsertNotificationUserSettings({ clearQuietHours: true }),
		);
	}, [
		quietHoursEndMin,
		quietHoursStartMin,
		runSave,
		upsertNotificationUserSettings,
	]);

	const setQuietHoursEnabled = useCallback(
		(enabled: boolean) => {
			if (!enabled) {
				clearQuietHours();
				return;
			}
			const nextStart = isQuietHoursBlank
				? minutesToTimeInput(
						quietHoursStartMin ?? DEFAULT_QUIET_HOURS_START_MIN,
					)
				: quietStartInput;
			const nextEnd = isQuietHoursBlank
				? minutesToTimeInput(quietHoursEndMin ?? DEFAULT_QUIET_HOURS_END_MIN)
				: quietEndInput;
			setQuietStartInput(nextStart);
			setQuietEndInput(nextEnd);
			const nextStartMin = timeInputToMinutes(nextStart);
			const nextEndMin = timeInputToMinutes(nextEnd);
			if (nextStartMin === undefined || nextEndMin === undefined) {
				return;
			}
			saveQuietHoursRange(nextStartMin, nextEndMin);
		},
		[
			clearQuietHours,
			isQuietHoursBlank,
			quietEndInput,
			quietHoursEndMin,
			quietHoursStartMin,
			quietStartInput,
			saveQuietHoursRange,
		],
	);

	const toggleEmail = useCallback(
		(row: PreferenceRowViewModel) => {
			void savePreference({
				type: row.type,
				channel: "email",
				enabled: !row.enabled,
			});
		},
		[savePreference],
	);

	const setEmailEnabledForFiltered = useCallback(
		(enabled: boolean) => {
			const rowsToUpdate = filteredEmailRows.filter(
				(row) => row.enabled !== enabled,
			);
			if (rowsToUpdate.length === 0) {
				return;
			}
			void runSave(EMAIL_BULK_SAVE_KEY, async () => {
				const results = await Promise.all(
					rowsToUpdate.map((row) =>
						runSave(
							row.key,
							() =>
								upsertNotificationPreference({
									type: row.type,
									channel: "email",
									enabled,
								}),
							{ toastOnError: false },
						),
					),
				);
				if (results.every(Boolean)) {
					return;
				}
				throw new Error("Some email settings could not be saved.");
			});
		},
		[filteredEmailRows, runSave, upsertNotificationPreference],
	);

	const toggleOverrideEnabled = useCallback(
		(row: PreferenceRowViewModel) => {
			if (!row.isOverride) {
				void savePreference({
					type: row.type,
					channel: "in_app",
					enabled: row.enabled,
					respectQuietHours: true,
				});
				return;
			}
			void savePreference({
				type: row.type,
				channel: "in_app",
				enabled: !row.enabled,
			});
		},
		[savePreference],
	);

	const toggleOverrideQuietHours = useCallback(
		(row: PreferenceRowViewModel) => {
			if (!row.isOverride) {
				void savePreference({
					type: row.type,
					channel: "in_app",
					enabled: row.enabled,
					respectQuietHours: true,
				});
				return;
			}
			void savePreference({
				type: row.type,
				channel: "in_app",
				respectQuietHours: !row.respectQuietHours,
			});
		},
		[savePreference],
	);

	const clearOverride = useCallback(
		(row: PreferenceRowViewModel) => {
			if (!row.isOverride) {
				return;
			}
			void savePreference({
				type: row.type,
				channel: "in_app",
				clearOverride: true,
			});
		},
		[savePreference],
	);

	const unsubscribe = useCallback(
		(subscriptionId: Id<"notificationSubscriptions">) => {
			void runSave(getSubscriptionSaveKey(subscriptionId), () =>
				unsubscribeNotificationSubscription(subscriptionId),
			);
		},
		[runSave, unsubscribeNotificationSubscription],
	);

	const cleanupStaleSubscriptions = useCallback(() => {
		const staleSubscriptions = filteredSubscriptions.filter(
			(subscription) => subscription.isStale,
		);
		if (staleSubscriptions.length === 0) {
			return;
		}
		void runSave(SUBSCRIPTIONS_BULK_SAVE_KEY, async () => {
			const results = await Promise.all(
				staleSubscriptions.map((subscription) =>
					runSave(
						getSubscriptionSaveKey(subscription.id),
						() => unsubscribeNotificationSubscription(subscription.id),
						{ toastOnError: false },
					),
				),
			);
			if (results.every(Boolean)) {
				return;
			}
			throw new Error("Some stale subscriptions could not be removed.");
		});
	}, [filteredSubscriptions, runSave, unsubscribeNotificationSubscription]);

	return {
		isLoading: isSettingsLoading || isSubscriptionsLoading,
		defaultDigestMode,
		timezone,
		timezoneInput,
		setTimezoneInput,
		quietStartInput,
		setQuietStartInput,
		quietEndInput,
		setQuietEndInput,
		areQuietHoursValid,
		isQuietHoursBlank,
		isQuietHoursEnabled,
		quietHoursSummary,
		emailQuery,
		setEmailQuery,
		overrideQuery,
		setOverrideQuery,
		subscriptionQuery,
		setSubscriptionQuery,
		subscriptionFilter,
		setSubscriptionFilter,
		emailRows: filteredEmailRows,
		inAppRows: filteredInAppRows,
		subscriptions: filteredSubscriptions,
		emailBulkState,
		subscriptionsBulkState,
		lastSavedAt,
		defaultDigestSaveState: getSaveState(DEFAULT_DIGEST_SAVE_KEY),
		timezoneSaveState: getSaveState(TIMEZONE_SAVE_KEY),
		quietHoursSaveState: getSaveState(QUIET_HOURS_SAVE_KEY),
		emailBulkSaveState: getSaveState(EMAIL_BULK_SAVE_KEY),
		subscriptionsBulkSaveState: getSaveState(SUBSCRIPTIONS_BULK_SAVE_KEY),
		getRowSaveState: getSaveState,
		setDefaultDigestMode,
		commitTimezone,
		commitQuietHours,
		clearQuietHours,
		setQuietHoursEnabled,
		toggleEmail,
		setEmailEnabledForFiltered,
		toggleOverrideEnabled,
		toggleOverrideQuietHours,
		clearOverride,
		unsubscribe,
		cleanupStaleSubscriptions,
	};
}
