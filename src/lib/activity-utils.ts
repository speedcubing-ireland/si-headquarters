import type { ActivityEntry } from "@/data/types-new";

function formatOldToNew(
	label: string,
	oldVal?: string,
	newVal?: string,
): string {
	return `changed ${label} from "${oldVal ?? ""}" to "${newVal ?? ""}"`;
}

export function getActivityDescription(entry: ActivityEntry): string {
	const { entityType, type, oldValue, newValue } = entry;

	if (entityType === "update" && type === "created") {
		return "posted a progress update";
	}
	if (entityType === "competition") {
		if (type === "created") return "created this competition";
		if (type === "phase_changed")
			return formatOldToNew("phase", oldValue, newValue);
		return "updated this competition";
	}

	switch (type) {
		case "created":
			return "created this task";
		case "status_changed":
			return formatOldToNew("status", oldValue, newValue);
		case "priority_changed":
			return formatOldToNew("priority", oldValue, newValue);
		case "assignee_changed":
			if (!oldValue && newValue) return `assigned to ${newValue}`;
			if (oldValue && !newValue) return `unassigned from ${oldValue}`;
			return `reassigned from ${oldValue ?? ""} to ${newValue ?? ""}`;
		case "due_date_changed":
			if (!oldValue && newValue) return `set due date to ${newValue}`;
			if (oldValue && !newValue) return `removed due date (${oldValue})`;
			return `changed due date from ${oldValue ?? ""} to ${newValue ?? ""}`;
		case "label_added":
			return `added label "${newValue ?? ""}"`;
		case "label_removed":
			return `removed label "${oldValue ?? ""}"`;
		case "comment_added":
			return "added a comment";
		case "comment_edited":
			return "edited a comment";
		case "comment_deleted":
			return "deleted a comment";
		case "archived":
			return "archived this task";
		case "unarchived":
			return "restored this task from archive";
		case "phase_changed":
			return formatOldToNew("phase", oldValue, newValue);
		case "approved":
			return "approved this task";
		case "unapproved":
			return "unapproved this task";
		case "resources_changed":
			return "updated resources";
		default:
			return "made an update";
	}
}

export function formatRelativeTime(timestamp: string): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSecs = Math.floor(diffMs / 1000);
	const diffMins = Math.floor(diffSecs / 60);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSecs < 60) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
	});
}

export function getEntityLink(
	entry: ActivityEntry,
): { to: string; params?: Record<string, string> } | null {
	switch (entry.entityType) {
		case "task":
			return { to: "/tasks/$id", params: { id: entry.entityId } };
		case "competition":
			return { to: "/competitions/$id", params: { id: entry.entityId } };
		case "update":
			return null;
		default:
			return null;
	}
}
