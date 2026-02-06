import type { Id } from "@/convex/_generated/dataModel";
import type { TableNames } from "@/convex/_generated/dataModel";

function isValidConvexId(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function createIdParser<T extends TableNames>(_tableName: T) {
	return (id: string | undefined): Id<T> | null => {
		if (!isValidConvexId(id)) return null;
		return id as Id<T>;
	};
}

function createIdRequirer<T extends TableNames>(
	tableName: T,
	parse: (id: string | undefined) => Id<T> | null,
) {
	return (id: string | undefined): Id<T> => {
		const parsed = parse(id);
		if (parsed == null) throw new Error(`${tableName} ID required`);
		return parsed;
	};
}

export const parseTaskId = createIdParser("tasks");
export const parseCompetitionId = createIdParser("competitions");
export const parseTeamId = createIdParser("teams");
export const parseCommentId = createIdParser("comments");
export const parseNotificationId = createIdParser("notifications");
export const parseReminderId = createIdParser("reminders");
export const parseSavedViewId = createIdParser("savedViews");
export const parseWeekendOverrideId = createIdParser("weekendOverrides");
export const parsePhaseId = createIdParser("phases");
export const parseCompetitionUpdateId = createIdParser("competitionUpdates");
export const parseUserId = createIdParser("users");

export const requireTaskId = createIdRequirer("tasks", parseTaskId);
export const requireCompetitionId = createIdRequirer(
	"competitions",
	parseCompetitionId,
);
export const requireTeamId = createIdRequirer("teams", parseTeamId);
