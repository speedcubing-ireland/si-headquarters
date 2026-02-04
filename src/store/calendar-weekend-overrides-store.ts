export type WeekendOverride = {
	eventNote?: string;
	reserved?: boolean;
	announced?: boolean;
};

export function getCalendarWeekendRowKey(
	satDate: string,
	competitionId: string | null,
): string {
	return competitionId ? `${satDate}-${competitionId}` : satDate;
}
