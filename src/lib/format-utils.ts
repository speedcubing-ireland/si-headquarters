import { format } from "date-fns";

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
	} catch (error) {
		console.warn("Failed to format date with pattern.", {
			date,
			pattern,
			error,
		});
		return date;
	}
}

export function formatDate(date?: string | null): string {
	return formatWithPattern(date, "MMM d, yyyy");
}

export function formatDateShort(date?: string | null): string {
	return formatWithPattern(date, "MMM d");
}

export type DateRangeDisplay = {
	start?: string;
	end?: string;
};

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
