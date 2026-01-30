import { format } from "date-fns";

/**
 * Get initials from a full name (first letter of first two words, uppercase)
 */
export function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function formatWithPattern(
	date: string | null | undefined,
	pattern: string,
): string {
	if (!date) return "";
	try {
		return format(new Date(date), pattern);
	} catch {
		return date;
	}
}

/** Format date to readable form (MMM d, yyyy). */
export function formatDate(date?: string | null): string {
	return formatWithPattern(date, "MMM d, yyyy");
}

/** Format date to short form (MMM d). */
export function formatDateShort(date?: string | null): string {
	return formatWithPattern(date, "MMM d");
}

export type DateRangeDisplay = {
	start?: string;
	end?: string;
};

/**
 * Format a date range for display in filter chips (e.g. "start – end", "from start", "until end").
 */
export function formatDateRangeForDisplay(
	dateRange: DateRangeDisplay,
	formatFn: (date: string) => string = formatDate,
): string {
	const { start, end } = dateRange;
	if (start && end) {
		return `${formatFn(start)} - ${formatFn(end)}`;
	}
	if (start) {
		return `from ${formatFn(start)}`;
	}
	if (end) {
		return `until ${formatFn(end)}`;
	}
	return "";
}
