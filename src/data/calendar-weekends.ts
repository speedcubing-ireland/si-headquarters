import { addDays, addMonths, format, startOfWeek, subMonths } from "date-fns";
import type { Competition, NonCompWeekendInfo, Weekend } from "./types-new";
import type { WeekendOverride } from "@/store/calendar-weekend-overrides-store";
import { getCalendarWeekendRowKey } from "@/store/calendar-weekend-overrides-store";

const WEEK_STARTS_ON = 1;
const CALENDAR_MONTHS_PAST = 3;
const CALENDAR_MONTHS_FUTURE = 15;

function getSaturdayOfWeek(weekStart: Date): Date {
	return addDays(weekStart, 5);
}

function getAllSaturdaysInRange(): Date[] {
	const now = new Date();
	const rangeStart = subMonths(now, CALENDAR_MONTHS_PAST);
	const rangeEnd = addMonths(now, CALENDAR_MONTHS_FUTURE);
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

function getSatDateKeyForDate(date: Date): string {
	const weekStart = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
	const sat = getSaturdayOfWeek(weekStart);
	return format(sat, "yyyy-MM-dd");
}

export function buildCalendarWeekends(competitions: Competition[]): Weekend[] {
	const saturdays = getAllSaturdaysInRange();
	const rangeStart = subMonths(new Date(), CALENDAR_MONTHS_PAST);
	const rangeEnd = addMonths(new Date(), CALENDAR_MONTHS_FUTURE);
	const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
	const rangeEndStr = format(rangeEnd, "yyyy-MM-dd");
	const compsInRange = competitions.filter(
		(c) => c.compStart >= rangeStartStr && c.compStart <= rangeEndStr,
	);
	const compsBySatKey = new Map<string, Competition[]>();
	for (const comp of compsInRange) {
		const key = getSatDateKeyForDate(new Date(comp.compStart));
		const list = compsBySatKey.get(key) ?? [];
		list.push(comp);
		compsBySatKey.set(key, list);
	}

	const rows: Weekend[] = [];
	for (const sat of saturdays) {
		const satKey = format(sat, "yyyy-MM-dd");
		const comps = compsBySatKey.get(satKey) ?? [];
		if (comps.length === 0) {
			rows.push({
				id: satKey,
				satDate: satKey,
				competition: null,
				weekendInfo: {
					id: satKey,
					satDate: satKey,
					eventNote: "",
					reserved: false,
					announced: false,
				} satisfies NonCompWeekendInfo,
			});
		} else {
			for (const comp of comps) {
				rows.push({
					id: `${satKey}-${comp.id}`,
					satDate: satKey,
					competition: comp,
					weekendInfo: null,
				});
			}
		}
	}
	return rows;
}

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
