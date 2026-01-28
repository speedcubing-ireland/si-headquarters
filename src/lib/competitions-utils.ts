import { format } from "date-fns";
import {
	type LucideIcon,
	Signal,
	SignalHigh,
	SignalMedium,
	TriangleAlert,
} from "lucide-react";
import type { Priority, Status } from "@/data/types";

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
 * Format status from kebab-case to Title Case
 */
export function formatStatus(status: Status): string {
	return status.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
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

/**
 * Get priority icon component
 */
export function getPriorityIcon(priority: Priority): LucideIcon {
	switch (priority) {
		case "urgent":
			return TriangleAlert;
		case "high":
			return Signal;
		case "medium":
			return SignalHigh;
		case "low":
			return SignalMedium;
	}
}

/**
 * Priority labels mapping
 */
export const priorityLabels: Record<Priority, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	urgent: "Urgent",
};

export {};
