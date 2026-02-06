import type { Id } from "@/convex/_generated/dataModel";

function isValidConvexId(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

export function parseTaskId(id: string | undefined): Id<"tasks"> | null {
	if (!isValidConvexId(id)) return null;
	return id as Id<"tasks">;
}

export function requireTaskId(id: string | undefined): Id<"tasks"> {
	const parsed = parseTaskId(id);
	if (parsed == null) throw new Error("Task ID required");
	return parsed;
}

export function parseCompetitionId(
	id: string | undefined,
): Id<"competitions"> | null {
	if (!isValidConvexId(id)) return null;
	return id as Id<"competitions">;
}

export function requireCompetitionId(
	id: string | undefined,
): Id<"competitions"> {
	const parsed = parseCompetitionId(id);
	if (parsed == null) throw new Error("Competition ID required");
	return parsed;
}

export function parseTeamId(id: string | undefined): Id<"teams"> | null {
	if (!isValidConvexId(id)) return null;
	return id as Id<"teams">;
}

export function requireTeamId(id: string | undefined): Id<"teams"> {
	const parsed = parseTeamId(id);
	if (parsed == null) throw new Error("Team ID required");
	return parsed;
}

export function parseCommentId(id: string | undefined): Id<"comments"> | null {
	if (!isValidConvexId(id)) return null;
	return id as Id<"comments">;
}

export function parseNotificationId(
	id: string | undefined,
): Id<"notifications"> | null {
	if (!isValidConvexId(id)) return null;
	return id as Id<"notifications">;
}

export function parseReminderId(
	id: string | undefined,
): Id<"reminders"> | null {
	if (!isValidConvexId(id)) return null;
	return id as Id<"reminders">;
}

export function parseSavedViewId(
	id: string | undefined,
): Id<"savedViews"> | null {
	if (!isValidConvexId(id)) return null;
	return id as Id<"savedViews">;
}

export function parseWeekendOverrideId(
	id: string | undefined,
): Id<"weekendOverrides"> | null {
	if (!isValidConvexId(id)) return null;
	return id as Id<"weekendOverrides">;
}

export function parsePhaseId(id: string | undefined): Id<"phases"> | null {
	if (!isValidConvexId(id)) return null;
	return id as Id<"phases">;
}

export function parseCompetitionUpdateId(
	id: string | undefined,
): Id<"competitionUpdates"> | null {
	if (!isValidConvexId(id)) return null;
	return id as Id<"competitionUpdates">;
}

export function parseUserId(id: string | undefined): Id<"users"> | null {
	if (!isValidConvexId(id)) return null;
	return id as Id<"users">;
}
