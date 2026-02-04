import {
	addHours,
	endOfDay,
	nextMonday,
	setHours,
	setMinutes,
	startOfTomorrow,
} from "date-fns";

export type ReminderPresetKey =
	| "in_1h"
	| "in_3h"
	| "later_today"
	| "tomorrow"
	| "next_week"
	| "custom";

const DEFAULT_REMIND_HOUR = 9;
const LATER_TODAY_HOUR = 18;

export type ReminderPresetOption = {
	key: ReminderPresetKey;
	label: string;
	getRemindAt: (from?: Date) => string;
};

const defaultFrom = () => new Date();

export const REMINDER_PRESETS: ReminderPresetOption[] = [
	{
		key: "in_1h",
		label: "In 1 hour",
		getRemindAt: (from = defaultFrom()) =>
			addHours(from, 1).toISOString(),
	},
	{
		key: "in_3h",
		label: "In 3 hours",
		getRemindAt: (from = defaultFrom()) =>
			addHours(from, 3).toISOString(),
	},
	{
		key: "later_today",
		label: "Later today",
		getRemindAt: (from = defaultFrom()) =>
			setMinutes(setHours(endOfDay(from), LATER_TODAY_HOUR), 0).toISOString(),
	},
	{
		key: "tomorrow",
		label: "Tomorrow",
		getRemindAt: (_from = defaultFrom()) =>
			setMinutes(setHours(startOfTomorrow(), DEFAULT_REMIND_HOUR), 0).toISOString(),
	},
	{
		key: "next_week",
		label: "Next week",
		getRemindAt: (from = defaultFrom()) =>
			setMinutes(setHours(nextMonday(from), DEFAULT_REMIND_HOUR), 0).toISOString(),
	},
	{
		key: "custom",
		label: "Custom",
		getRemindAt: (_from = defaultFrom()) => new Date().toISOString(),
	},
];

export const SNOOZE_PRESETS: ReminderPresetOption[] = REMINDER_PRESETS.filter(
	(p) => p.key !== "custom",
);

export function getRemindAtForPreset(
	presetKey: ReminderPresetKey,
	from?: Date,
	customDate?: Date,
): string {
	if (presetKey === "custom" && customDate) {
		return customDate.toISOString();
	}
	const preset = REMINDER_PRESETS.find((p) => p.key === presetKey);
	return preset ? preset.getRemindAt(from ?? new Date()) : new Date().toISOString();
}

export function getPresetLabel(key: ReminderPresetKey): string {
	return REMINDER_PRESETS.find((p) => p.key === key)?.label ?? key;
}
