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

/**
 * Format date string to readable format (MMM d, yyyy)
 */
export function formatDate(date?: string): string {
	if (!date) return "";
	try {
		return format(new Date(date), "MMM d, yyyy");
	} catch {
		return date;
	}
}
