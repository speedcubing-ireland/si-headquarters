import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import type { notificationDigestMode } from "./validators";
import { NOTIFICATION_DEFAULTS } from "../../lib/constants";

type NotificationDigestMode = Infer<typeof notificationDigestMode>;

type ZonedDateParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
};

type DispatchSchedule = {
	scheduledFor: number;
	digestWindowKey?: string;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function pad2(value: number): string {
	return value.toString().padStart(2, "0");
}

function getFormatter(timezone: string): Intl.DateTimeFormat {
	const existing = formatterCache.get(timezone);
	if (existing) {
		return existing;
	}

	const formatter = new Intl.DateTimeFormat("en-GB", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	});
	formatterCache.set(timezone, formatter);
	return formatter;
}

export function validateTimezone(timezone: string): void {
	try {
		getFormatter(timezone).format(new Date());
	} catch {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "timezone must be a valid IANA timezone",
		});
	}
}

export function validateQuietHoursWindow(
	startMin: number | undefined,
	endMin: number | undefined,
): void {
	const hasStart = startMin !== undefined;
	const hasEnd = endMin !== undefined;
	if (hasStart !== hasEnd) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message:
				"quiet hours require both quietHoursStartMin and quietHoursEndMin",
		});
	}

	if (!hasStart || !hasEnd) {
		return;
	}
	if (startMin === endMin) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message:
				"quietHoursStartMin and quietHoursEndMin cannot be the same minute",
		});
	}
}

function getZonedDateParts(
	timestamp: number,
	timezone: string,
): ZonedDateParts {
	const parts = getFormatter(timezone).formatToParts(new Date(timestamp));
	let year: number | null = null;
	let month: number | null = null;
	let day: number | null = null;
	let hour: number | null = null;
	let minute: number | null = null;

	for (const part of parts) {
		if (part.type === "year") {
			year = Number(part.value);
		}
		if (part.type === "month") {
			month = Number(part.value);
		}
		if (part.type === "day") {
			day = Number(part.value);
		}
		if (part.type === "hour") {
			hour = Number(part.value);
		}
		if (part.type === "minute") {
			minute = Number(part.value);
		}
	}

	if (
		year === null ||
		month === null ||
		day === null ||
		hour === null ||
		minute === null
	) {
		throw new ConvexError({
			code: "INTERNAL",
			message: "Unable to derive timezone date parts",
		});
	}

	return { year, month, day, hour, minute };
}

function formatDateKey(parts: ZonedDateParts): string {
	return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function formatHourKey(parts: ZonedDateParts): string {
	return `${formatDateKey(parts)}T${pad2(parts.hour)}`;
}

function formatMinuteKey(parts: ZonedDateParts): string {
	return `${formatDateKey(parts)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

function truncateToMinute(timestamp: number): number {
	return timestamp - (timestamp % (60 * 1000));
}

function getLocalMinuteOfDay(timestamp: number, timezone: string): number {
	const parts = getZonedDateParts(timestamp, timezone);
	return parts.hour * 60 + parts.minute;
}

function isWithinQuietHours(
	localMinute: number,
	startMin: number,
	endMin: number,
): boolean {
	if (startMin < endMin) {
		return localMinute >= startMin && localMinute < endMin;
	}
	return localMinute >= startMin || localMinute < endMin;
}

function findNextTimestampMatchingLocalMinute(
	fromTimestamp: number,
	timezone: string,
	targetMinuteOfDay: number,
	maxLookaheadMinutes: number,
): number {
	for (let step = 1; step <= maxLookaheadMinutes; step += 1) {
		const candidate = fromTimestamp + step * 60 * 1000;
		if (getLocalMinuteOfDay(candidate, timezone) === targetMinuteOfDay) {
			return candidate;
		}
	}
	return fromTimestamp + maxLookaheadMinutes * 60 * 1000;
}

function findNextTimestampMatchingLocalMinuteOfHour(
	fromTimestamp: number,
	timezone: string,
	targetMinute: number,
	maxLookaheadMinutes: number,
): number {
	for (let step = 1; step <= maxLookaheadMinutes; step += 1) {
		const candidate = fromTimestamp + step * 60 * 1000;
		const localMinute = getZonedDateParts(candidate, timezone).minute;
		if (localMinute === targetMinute) {
			return candidate;
		}
	}
	return fromTimestamp + maxLookaheadMinutes * 60 * 1000;
}

function findNextTimestampMatchingAnyLocalMinute(
	fromTimestamp: number,
	timezone: string,
	targetMinutesOfDay: readonly number[],
	maxLookaheadMinutes: number,
): number {
	const targetSet = new Set(targetMinutesOfDay);
	for (let step = 1; step <= maxLookaheadMinutes; step += 1) {
		const candidate = fromTimestamp + step * 60 * 1000;
		if (targetSet.has(getLocalMinuteOfDay(candidate, timezone))) {
			return candidate;
		}
	}
	return fromTimestamp + maxLookaheadMinutes * 60 * 1000;
}

function applyQuietHoursDelay(
	timestamp: number,
	timezone: string,
	quietStartMin: number | undefined,
	quietEndMin: number | undefined,
): number {
	if (quietStartMin === undefined || quietEndMin === undefined) {
		return timestamp;
	}

	let candidate = timestamp;
	const maxLookaheadMinutes =
		NOTIFICATION_DEFAULTS.MAX_DIGEST_LOOKAHEAD_MINUTES;
	for (let step = 0; step <= maxLookaheadMinutes; step += 1) {
		const localMinute = getLocalMinuteOfDay(candidate, timezone);
		if (!isWithinQuietHours(localMinute, quietStartMin, quietEndMin)) {
			return candidate;
		}
		candidate += 60 * 1000;
	}
	return candidate;
}

export function computeDispatchSchedule(args: {
	now: number;
	timezone: string;
	digestMode: NotificationDigestMode;
	quietHoursStartMin: number | undefined;
	quietHoursEndMin: number | undefined;
}): DispatchSchedule {
	const localNowParts = getZonedDateParts(args.now, args.timezone);
	const maxLookaheadMinutes =
		NOTIFICATION_DEFAULTS.MAX_DIGEST_LOOKAHEAD_MINUTES;

	if (args.digestMode === "immediate") {
		const delayed = applyQuietHoursDelay(
			args.now,
			args.timezone,
			args.quietHoursStartMin,
			args.quietHoursEndMin,
		);
		if (delayed > args.now) {
			const scheduledFor = truncateToMinute(delayed);
			const scheduledParts = getZonedDateParts(scheduledFor, args.timezone);
			return {
				scheduledFor,
				digestWindowKey: `quiet:${formatMinuteKey(scheduledParts)}`,
			};
		}
		return {
			scheduledFor: args.now,
		};
	}

	if (args.digestMode === "hourly") {
		const scheduledForBase = truncateToMinute(
			findNextTimestampMatchingLocalMinuteOfHour(
				args.now,
				args.timezone,
				0,
				maxLookaheadMinutes,
			),
		);
		const scheduledFor = truncateToMinute(
			applyQuietHoursDelay(
				scheduledForBase,
				args.timezone,
				args.quietHoursStartMin,
				args.quietHoursEndMin,
			),
		);
		return {
			scheduledFor,
			digestWindowKey: formatHourKey(localNowParts),
		};
	}

	if (args.digestMode === "three_daily") {
		const scheduledForBase = truncateToMinute(
			findNextTimestampMatchingAnyLocalMinute(
				args.now,
				args.timezone,
				NOTIFICATION_DEFAULTS.THREE_DAILY_DIGEST_SEND_MINUTES,
				maxLookaheadMinutes,
			),
		);
		const scheduledParts = getZonedDateParts(scheduledForBase, args.timezone);
		return {
			scheduledFor: truncateToMinute(
				applyQuietHoursDelay(
					scheduledForBase,
					args.timezone,
					args.quietHoursStartMin,
					args.quietHoursEndMin,
				),
			),
			digestWindowKey: `${formatDateKey(scheduledParts)}T${pad2(scheduledParts.hour)}`,
		};
	}

	const dailyTargetMinute = NOTIFICATION_DEFAULTS.DAILY_DIGEST_SEND_MINUTE;
	const scheduledForBase = truncateToMinute(
		findNextTimestampMatchingLocalMinute(
			args.now,
			args.timezone,
			dailyTargetMinute,
			maxLookaheadMinutes,
		),
	);

	const scheduledParts = getZonedDateParts(scheduledForBase, args.timezone);
	return {
		scheduledFor: truncateToMinute(
			applyQuietHoursDelay(
				scheduledForBase,
				args.timezone,
				args.quietHoursStartMin,
				args.quietHoursEndMin,
			),
		),
		digestWindowKey: formatDateKey(scheduledParts),
	};
}
