import { faker } from "@faker-js/faker";
import { addDays, addMonths, format, startOfWeek, subMonths } from "date-fns";
import type { Competition, NonCompWeekendInfo, Weekend } from "./types-new";
import type { WeekendOverride } from "@/store/calendar-weekend-overrides-store";
import { getCalendarWeekendRowKey } from "@/store/calendar-weekend-overrides-store";

const WEEK_STARTS_ON = 1; // Monday

function getSaturdayOfWeek(weekStart: Date): Date {
	return addDays(weekStart, 5);
}

/** All Saturdays from 3 months ago through 15 months in the future (by week start Mon). */
function getAllSaturdaysInRange(): Date[] {
	const now = new Date();
	const rangeStart = subMonths(now, 3);
	const rangeEnd = addMonths(now, 15);
	const start = startOfWeek(rangeStart, { weekStartsOn: WEEK_STARTS_ON });
	const saturdays: Date[] = [];
	let weekStart = start;
	while (weekStart < rangeEnd) {
		const sat = getSaturdayOfWeek(weekStart);
		if (sat >= rangeStart && sat <= rangeEnd) {
			saturdays.push(sat);
		}
		weekStart = addDays(weekStart, 7);
	}
	return saturdays;
}

/** Saturday date string (YYYY-MM-DD) for the week that contains the given date. */
function getSatDateKeyForDate(date: Date): string {
	const weekStart = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
	const sat = getSaturdayOfWeek(weekStart);
	return format(sat, "yyyy-MM-dd");
}

/**
 * Build calendar weekend rows from the same competitions as the main competitions page.
 * Every weekend in range (3 months ago → 15 months future); multiple rows per week when
 * that week has multiple competitions (displayed one after another).
 */
export function buildCalendarWeekends(competitions: Competition[]): Weekend[] {
	const saturdays = getAllSaturdaysInRange();
	const rangeStart = subMonths(new Date(), 3);
	const rangeEnd = addMonths(new Date(), 15);

	// Only include competitions whose compStart falls within the calendar range
	const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
	const rangeEndStr = format(rangeEnd, "yyyy-MM-dd");
	const compsInRange = competitions.filter(
		(c) => c.compStart >= rangeStartStr && c.compStart <= rangeEndStr,
	);

	// Group competitions by week (Saturday key)
	const compsBySatKey = new Map<string, Competition[]>();
	for (const comp of compsInRange) {
		const key = getSatDateKeyForDate(new Date(comp.compStart));
		const list = compsBySatKey.get(key) ?? [];
		list.push(comp);
		compsBySatKey.set(key, list);
	}

	// Build one row per weekend; if multiple comps in that week, one row per comp (one after another)
	const rows: Weekend[] = [];
	for (const sat of saturdays) {
		const satKey = format(sat, "yyyy-MM-dd");
		const comps = compsBySatKey.get(satKey) ?? [];
		if (comps.length === 0) {
			rows.push({
				id: faker.string.uuid(),
				satDate: satKey,
				competition: null,
				weekendInfo: {
					id: faker.string.uuid(),
					satDate: satKey,
					eventNote: "",
					reserved: false,
					announced: false,
				} satisfies NonCompWeekendInfo,
			});
		} else {
			for (const comp of comps) {
				rows.push({
					id: faker.string.uuid(),
					satDate: satKey,
					competition: comp,
					weekendInfo: null,
				});
			}
		}
	}
	return rows;
}

/** Merge weekend overrides (inline edits) into weekend rows for display. */
export function mergeWeekendsWithOverrides(
	weekends: Weekend[],
	overrides: Record<string, WeekendOverride>,
): Weekend[] {
	return weekends.map((w) => {
		const rowKey = getCalendarWeekendRowKey(
			w.satDate,
			w.competition?.id ?? null,
		);
		const override = overrides[rowKey];
		if (!override || w.competition) return w;
		const info = w.weekendInfo;
		return {
			...w,
			weekendInfo: {
				...info,
				eventNote:
					override.eventNote !== undefined
						? override.eventNote
						: info.eventNote,
				reserved:
					override.reserved !== undefined ? override.reserved : info.reserved,
				announced:
					override.announced !== undefined
						? override.announced
						: info.announced,
			},
		};
	});
}
