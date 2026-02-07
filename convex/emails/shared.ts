import type { TailwindConfig } from "@react-email/components";
import { pixelBasedPreset } from "@react-email/components";

export const emailTailwindConfig = {
	presets: [pixelBasedPreset],
	theme: {
		extend: {
			colors: {
				brand: {
					primary: "#c2792a",
					"primary-fg": "#ffffff",
					bg: "#fcfaf7",
					surface: "#ffffff",
					foreground: "#4a3628",
					muted: "#6b5b4e",
					border: "#ddd5ca",
					cream: "#eee6d9",
					destructive: "#d93636",
					warning: "#f59e0b",
				},
			},
		},
	},
} satisfies TailwindConfig;

export function buildEntityLink(
	appUrl: string,
	input: {
		entityType: string;
		entityId: string;
		parentEntityId?: string;
	},
): string {
	switch (input.entityType) {
		case "task":
			return `${appUrl}/tasks/${input.entityId}`;
		case "competition":
			return `${appUrl}/competitions/${input.entityId}`;
		case "comment":
		case "reminder":
			return input.parentEntityId
				? `${appUrl}/tasks/${input.parentEntityId}`
				: `${appUrl}/inbox`;
		default:
			return `${appUrl}/inbox`;
	}
}

export function formatEntityTypeLabel(entityType: string): string {
	switch (entityType) {
		case "task":
			return "Task";
		case "competition":
			return "Competition";
		case "comment":
			return "Comment";
		case "reminder":
			return "Reminder";
		default:
			return "Notification";
	}
}

export function getPriorityBadge(priority: string): {
	label: string;
	bgClass: string;
	textClass: string;
} | null {
	switch (priority) {
		case "urgent":
			return {
				label: "Urgent",
				bgClass: "bg-brand-destructive",
				textClass: "text-white",
			};
		case "high":
			return {
				label: "High",
				bgClass: "bg-brand-warning",
				textClass: "text-white",
			};
		default:
			return null;
	}
}
