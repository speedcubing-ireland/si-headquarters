"use node";

import { action } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import type { GenericActionCtx } from "convex/server";
import { ConvexError, v } from "convex/values";
import { google } from "googleapis";
import { fromZonedTime } from "date-fns-tz";
import { TOKEN_VALID_BUFFER_SEC } from "./lib/constants";
import type {
	Activity,
	Event,
	Round,
	Schedule,
	Venue,
	Room,
	Competition as WcifCompetition,
	EventId,
} from "@wca/helpers";

const WCA_BASE = "https://www.worldcubeassociation.org";
const WCA_API = `${WCA_BASE}/api/v0`;
const SATURDAY_RANGE = "Schedule!AH6:AK";
const SUNDAY_RANGE = "Schedule!AM6:AP";
const DUBLIN_TIMEZONE = "Europe/Dublin";
const IRELAND_TEMPLATE_COMPETITION_ID = "IrelandTemplate2100";

export const MULTI_ATTEMPT_EVENTS = new Set(["333fm", "333mbf"]);

export const EVENT_NAME_TO_ID: Record<string, string> = {
	"3x3": "333",
	"2x2": "222",
	"4x4": "444",
	"5x5": "555",
	"6x6": "666",
	"7x7": "777",
	"3x3 blindfolded": "333bf",
	"3x3 fewest moves": "333fm",
	"3x3 one-handed": "333oh",
	clock: "clock",
	megaminx: "minx",
	pyraminx: "pyram",
	skewb: "skewb",
	"square-1": "sq1",
	"4x4 blindfolded": "444bf",
	"5x5 blindfolded": "555bf",
	"3x3 multi-blind": "333mbf",
};

type OtherActivityDef = {
	activityCode: string;
	displayName: string;
};

const OTHER_ACTIVITIES: Record<string, OtherActivityDef> = {
	"intro to competing": {
		activityCode: "other-tutorial",
		displayName: "Tutorial for new competitors",
	},
	awards: {
		activityCode: "other-awards",
		displayName: "Awards",
	},
	"registration opens": {
		activityCode: "other-checkin",
		displayName: "Check-in",
	},
	lunch: {
		activityCode: "other-lunch",
		displayName: "Lunch",
	},
	"lunch (sat)": {
		activityCode: "other-lunch",
		displayName: "Lunch",
	},
	"lunch (sun)": {
		activityCode: "other-lunch",
		displayName: "Lunch",
	},
};

const ROUND_FORMATS: Record<string, string> = {
	"333fm-1": "3",
	"333fm-2": "2",
	"333fm-3": "m",
	"333mbf-1": "3",
	"333mbf-2": "2",
	"333mbf-3": "3",
	"333bf": "3",
	"666": "m",
	"777": "m",
	"444bf": "3",
	"555bf": "3",
};

export function getRoundFormat(
	eventId: string,
	attemptCount: number,
): "1" | "2" | "3" | "a" | "m" {
	const key = `${eventId}-${attemptCount}`;
	const format = ROUND_FORMATS[key] || ROUND_FORMATS[eventId];
	return (format as "1" | "2" | "3" | "a" | "m") || "a";
}

function defaultTimeLimit(eventId: string) {
	if (eventId === "333fm" || eventId === "333mbf") return null;
	return { centiseconds: 60000, cumulativeRoundIds: [] };
}

function normalize(name: string) {
	return name.trim().toLowerCase();
}

function getActivityCode(name: string, round: number): string {
	const normalized = normalize(name);

	const eventId = EVENT_NAME_TO_ID[normalized];
	if (eventId) {
		return `${eventId}-r${round}`;
	}

	const otherDef = OTHER_ACTIVITIES[normalized];
	if (otherDef) {
		return otherDef.activityCode;
	}

	throw new Error(
		`Unknown activity: "${name}". Must be a valid event or one of: Intro to competing, Awards, Registration Opens, Lunch`,
	);
}

function getActivityDisplayName(name: string): string {
	const normalized = normalize(name);

	const otherDef = OTHER_ACTIVITIES[normalized];
	if (otherDef) {
		return otherDef.displayName;
	}

	return name;
}

function isEvent(name: string): boolean {
	return !!EVENT_NAME_TO_ID[normalize(name)];
}

type SheetRow = {
	time: string;
	length: string;
	event: string;
	round: string;
};

type CompetitionInfo = {
	wcaCompetitionId?: string;
	compSheet?: { sheetId: string };
	compStart: string;
	compEnd: string;
};

type TokenData = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
};

type RefreshResult = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
};

async function manageAccessToken(
	_getToken: () => Promise<TokenData | null>,
	refreshToken: (token: TokenData) => Promise<RefreshResult | null>,
	saveToken: (result: RefreshResult) => Promise<void>,
): Promise<string | null> {
	const token = await _getToken();
	if (!token) return null;

	const nowSec = Math.floor(Date.now() / 1000);
	const isValid = token.expiresAt > nowSec + TOKEN_VALID_BUFFER_SEC;
	if (isValid) return token.accessToken;

	const refreshed = await refreshToken(token);
	if (!refreshed) return token.accessToken;

	await saveToken(refreshed);
	return refreshed.accessToken;
}

async function refreshGoogleToken(
	token: TokenData,
): Promise<RefreshResult | null> {
	const clientId = process.env.AUTH_GOOGLE_ID;
	const clientSecret = process.env.AUTH_GOOGLE_SECRET;
	if (!clientId || !clientSecret) return null;

	const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
	oauth2.setCredentials({
		access_token: token.accessToken,
		refresh_token: token.refreshToken,
	});

	const { credentials } = await oauth2.refreshAccessToken();
	if (!credentials.access_token || !credentials.expiry_date) {
		return null;
	}

	return {
		accessToken: credentials.access_token,
		refreshToken: (credentials.refresh_token as string) ?? token.refreshToken,
		expiresAt: Math.floor(credentials.expiry_date / 1000),
	};
}

async function getGoogleAccessToken(
	ctx: GenericActionCtx<DataModel>,
): Promise<string | null> {
	return manageAccessToken(
		() =>
			ctx.runQuery(
				internal.sheetsQueries.getGoogleSheetsToken,
				{},
			) as Promise<TokenData | null>,
		refreshGoogleToken,
		async (result) => {
			await ctx.runMutation(internal.sheetsQueries.setGoogleSheetsTokens, {
				accessToken: result.accessToken,
				refreshToken: result.refreshToken,
				expiresAt: result.expiresAt,
			});
		},
	);
}

async function refreshWcaToken(
	token: TokenData,
): Promise<RefreshResult | null> {
	if (!token.refreshToken) return null;

	const clientId = process.env.AUTH_WCA_ID;
	const clientSecret = process.env.AUTH_WCA_SECRET;
	if (!clientId || !clientSecret) return null;

	const res = await fetch(`${WCA_BASE}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: token.refreshToken,
			client_id: clientId,
			client_secret: clientSecret,
		}),
	});

	if (!res.ok) return null;

	const newTokens = (await res.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
		created_at?: number;
	};

	if (!newTokens.access_token) return null;

	const expiresAt = newTokens.created_at
		? newTokens.created_at + (newTokens.expires_in ?? 7200)
		: Math.floor(Date.now() / 1000) + (newTokens.expires_in ?? 7200);

	return {
		accessToken: newTokens.access_token,
		refreshToken: newTokens.refresh_token ?? token.refreshToken,
		expiresAt,
	};
}

async function getWcaAccessToken(
	ctx: GenericActionCtx<DataModel>,
): Promise<string | null> {
	return manageAccessToken(
		() =>
			ctx.runQuery(
				internal.wcaQueries.getWcaToken,
				{},
			) as Promise<TokenData | null>,
		refreshWcaToken,
		async (result) => {
			await ctx.runMutation(internal.wcaQueries.setWcaTokens, {
				accessToken: result.accessToken,
				refreshToken: result.refreshToken,
				expiresAt: result.expiresAt,
			});
		},
	);
}

function parseDuration(length: string): number {
	const parts = length.split(":").map(Number);
	if (parts.length === 3) {
		return parts[0] * 60 + parts[1];
	}
	return parts[0] * 60 + parts[1] || 0;
}

function parseSheetRows(rows: string[][]): SheetRow[] {
	return rows
		.map((row) => ({
			time: (row[0] ?? "").trim(),
			length: (row[1] ?? "").trim(),
			event: (row[2] ?? "").trim(),
			round: (row[3] ?? "").trim(),
		}))
		.filter((r) => r.time && r.event);
}

async function fetchScheduleFromSheets(
	spreadsheetId: string,
	accessToken: string,
): Promise<{ saturday: SheetRow[]; sunday: SheetRow[] }> {
	const oauth2 = new google.auth.OAuth2();
	oauth2.setCredentials({ access_token: accessToken });
	const sheets = google.sheets({ version: "v4", auth: oauth2 });

	const [satRes, sunRes] = await Promise.all([
		sheets.spreadsheets.values.get({
			spreadsheetId,
			range: SATURDAY_RANGE,
		}),
		sheets.spreadsheets.values.get({
			spreadsheetId,
			range: SUNDAY_RANGE,
		}),
	]);

	return {
		saturday: parseSheetRows((satRes.data.values ?? []) as string[][]),
		sunday: parseSheetRows((sunRes.data.values ?? []) as string[][]),
	};
}

function formatDublinTime(
	dateStr: string,
	hours: number,
	minutes: number,
): string {
	const dublinTimeStr = `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
	return fromZonedTime(dublinTimeStr, DUBLIN_TIMEZONE).toISOString();
}

function getNextDay(dateStr: string): string {
	const date = new Date(dateStr);
	date.setDate(date.getDate() + 1);
	return date.toISOString().split("T")[0];
}

function buildActivity(row: SheetRow, dateStr: string, id: number): Activity {
	const [hours, minutes] = row.time.split(":").map(Number);
	const durationMin = parseDuration(row.length);

	const startDate = new Date(`${dateStr}T00:00:00`);
	startDate.setHours(hours, minutes, 0, 0);
	const endDate = new Date(startDate.getTime() + durationMin * 60_000);

	const roundNum = Number.parseInt(row.round, 10) || 1;
	const activityCode = getActivityCode(row.event, roundNum);
	const isEventActivity = isEvent(row.event);
	const name = isEventActivity
		? `${row.event}, Round ${roundNum}`
		: getActivityDisplayName(row.event);

	return {
		id,
		name,
		activityCode,
		startTime: formatDublinTime(dateStr, hours, minutes),
		endTime: formatDublinTime(
			dateStr,
			endDate.getHours(),
			endDate.getMinutes(),
		),
		childActivities: [],
		scrambleSetId: null,
		extensions: [],
	};
}

function buildDayActivities(
	rows: SheetRow[],
	dateStr: string,
	startId: number,
): { activities: Activity[]; nextId: number } {
	const activities: Activity[] = [];
	let id = startId;

	for (const row of rows) {
		const durationMin = parseDuration(row.length);
		if (durationMin <= 0) continue;

		activities.push(buildActivity(row, dateStr, id++));
	}

	return { activities, nextId: id };
}

async function fetchWcaCompetition(
	competitionId: string,
	token: string,
): Promise<WcifCompetition | null> {
	const res = await fetch(
		`${WCA_API}/competitions/${encodeURIComponent(competitionId)}/wcif`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	return res.ok ? ((await res.json()) as WcifCompetition) : null;
}

async function fetchIrelandTemplate(
	token: string,
): Promise<Map<string, Round>> {
	const res = await fetch(
		`${WCA_API}/competitions/${encodeURIComponent(IRELAND_TEMPLATE_COMPETITION_ID)}/wcif`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);

	if (!res.ok) return new Map();

	const wcif = (await res.json()) as WcifCompetition;
	const roundsMap = new Map<string, Round>();

	for (const event of wcif.events) {
		for (const round of event.rounds) {
			roundsMap.set(round.id, round);
		}
	}

	return roundsMap;
}

async function fetchCompetitionVenueInfo(
	competitionId: string,
	token: string,
): Promise<{
	name: string;
	detail: string;
	lat: number;
	lng: number;
	country: string;
} | null> {
	const res = await fetch(
		`${WCA_API}/competitions/${encodeURIComponent(competitionId)}`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);

	if (!res.ok) return null;

	const info = (await res.json()) as {
		venue?: string;
		venue_details?: string;
		latitude_degrees?: number;
		longitude_degrees?: number;
		country_iso2?: string;
	};

	return {
		name: info.venue ?? "Main Venue",
		detail: info.venue_details ?? "Main Stage",
		lat: info.latitude_degrees ?? 0,
		lng: info.longitude_degrees ?? 0,
		country: info.country_iso2 ?? "IE",
	};
}

async function updateWcaSchedule(
	competitionId: string,
	token: string,
	wcif: { id: string; events: Event[]; schedule: Schedule },
): Promise<{ success: boolean; error?: string }> {
	const res = await fetch(
		`${WCA_API}/competitions/${encodeURIComponent(competitionId)}/wcif`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(wcif),
		},
	);

	if (!res.ok) {
		const text = await res.text();
		return {
			success: false,
			error: `WCA rejected WCIF update: ${res.status} ${text}`,
		};
	}

	return { success: true };
}

function extractEventRounds(activities: Activity[]): Map<string, Set<number>> {
	const rounds = new Map<string, Set<number>>();

	for (const activity of activities) {
		const match = activity.activityCode.match(/^([a-z0-9]+)-r(\d+)$/);
		if (!match) continue;

		const [, eventId, roundStr] = match;
		if (!eventId || !roundStr) continue;

		if (!rounds.has(eventId)) rounds.set(eventId, new Set());
		rounds.get(eventId)?.add(Number(roundStr));
	}

	return rounds;
}

function countMultiAttempts(activities: Activity[]): Map<string, number> {
	const counts = new Map<string, number>();

	for (const activity of activities) {
		const match = activity.activityCode.match(/^([a-z0-9]+)-r/);
		if (!match) continue;

		const eventId = match[1];
		if (!eventId || !MULTI_ATTEMPT_EVENTS.has(eventId)) continue;

		counts.set(eventId, (counts.get(eventId) || 0) + 1);
	}

	return counts;
}

function createRound(
	roundId: string,
	eventId: string,
	isMultiAttempt: boolean,
	attemptCount: number,
	existingRound: Round | undefined,
	templateRound: Round | undefined,
): Round {
	if (existingRound) return existingRound;

	if (templateRound) {
		return {
			id: roundId,
			format: templateRound.format,
			timeLimit: templateRound.timeLimit,
			cutoff: templateRound.cutoff,
			advancementCondition: templateRound.advancementCondition,
			results: [],
			scrambleSetCount: templateRound.scrambleSetCount,
			extensions: [],
		};
	}

	const format = getRoundFormat(eventId, isMultiAttempt ? attemptCount : 1);

	return {
		id: roundId,
		format,
		timeLimit: defaultTimeLimit(eventId),
		cutoff: null,
		advancementCondition: null,
		results: [],
		scrambleSetCount: 1,
		extensions: [],
	};
}

function buildEvents(
	activities: Activity[],
	existingEvents: Event[],
	templateRounds: Map<string, Round>,
): Event[] {
	const roundsMap = extractEventRounds(activities);
	const attemptCounts = countMultiAttempts(activities);
	const existingEventsMap = new Map<string, Event>(
		existingEvents.map((e) => [e.id, e]),
	);

	const events: Event[] = [];

	for (const [eventId, roundNums] of roundsMap) {
		const existingEvent = existingEventsMap.get(eventId as EventId);
		const sortedRounds = [...roundNums].sort((a, b) => a - b);
		const isMultiAttempt = MULTI_ATTEMPT_EVENTS.has(eventId);
		const attemptCount = attemptCounts.get(eventId) || sortedRounds.length;

		const rounds: Round[] = sortedRounds.map((roundNum) => {
			const roundId = `${eventId}-r${roundNum}`;
			const existingRound = existingEvent?.rounds.find((r) => r.id === roundId);
			const templateRound = templateRounds.get(roundId);

			return createRound(
				roundId,
				eventId,
				isMultiAttempt,
				attemptCount,
				existingRound,
				templateRound,
			);
		});

		events.push({
			id: eventId as EventId,
			rounds,
			extensions: existingEvent?.extensions ?? [],
			competitorLimit: existingEvent?.competitorLimit ?? null,
			qualification: existingEvent?.qualification ?? null,
		});
	}

	return events;
}

function buildRoom(
	existingVenue: Venue | undefined,
	venueInfo: { detail: string } | null,
	activities: Activity[],
): Room {
	return {
		id: existingVenue?.rooms?.[0]?.id ?? 1,
		name: existingVenue?.rooms?.[0]?.name ?? venueInfo?.detail ?? "Main Stage",
		color: existingVenue?.rooms?.[0]?.color ?? "#304a96",
		activities,
		extensions: [],
	};
}

function buildVenue(
	existingVenue: Venue | undefined,
	venueInfo: { name: string; lat: number; lng: number; country: string } | null,
	room: Room,
): Venue {
	if (existingVenue) {
		return { ...existingVenue, rooms: [room] };
	}

	return {
		id: 1,
		name: venueInfo?.name ?? "Main Venue",
		latitudeMicrodegrees: Math.round((venueInfo?.lat ?? 0) * 1e6),
		longitudeMicrodegrees: Math.round((venueInfo?.lng ?? 0) * 1e6),
		countryIso2: venueInfo?.country ?? "IE",
		timezone: DUBLIN_TIMEZONE,
		rooms: [room],
		extensions: [],
	};
}

export const pushScheduleToWca = action({
	args: { competitionId: v.id("competitions") },
	returns: v.object({
		success: v.boolean(),
		error: v.optional(v.string()),
		activitiesCreated: v.optional(v.number()),
	}),
	handler: async (ctx, args) => {
		const isVolunteer = await ctx.runQuery(internal.auth.getIsVolunteer, {});
		if (!isVolunteer) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Volunteer access required",
			});
		}

		const competition = (await ctx.runQuery(internal.competitions.getInternal, {
			id: args.competitionId,
		})) as CompetitionInfo | null;

		if (!competition) {
			return { success: false, error: "Competition not found" };
		}

		if (!competition.wcaCompetitionId) {
			return {
				success: false,
				error: "Competition is not linked to WCA. Link it first.",
			};
		}

		if (!competition.compSheet) {
			return {
				success: false,
				error:
					"No Google Sheet linked. Add a sheet with a Schedule page first.",
			};
		}

		const googleToken = await getGoogleAccessToken(ctx);
		if (!googleToken) {
			return {
				success: false,
				error: "No Google Sheets token. Run: bun run auth:google-sheets",
			};
		}

		const wcaToken = await getWcaAccessToken(ctx);
		if (!wcaToken) {
			return {
				success: false,
				error: "No WCA token. Run: bun run auth:wca",
			};
		}

		let scheduleData: { saturday: SheetRow[]; sunday: SheetRow[] };
		try {
			scheduleData = await fetchScheduleFromSheets(
				competition.compSheet.sheetId,
				googleToken,
			);
		} catch (err) {
			return {
				success: false,
				error: `Failed to read sheet: ${err instanceof Error ? err.message : "Unknown error"}`,
			};
		}

		if (
			scheduleData.saturday.length === 0 &&
			scheduleData.sunday.length === 0
		) {
			return {
				success: false,
				error: "No schedule entries found in the sheet",
			};
		}

		const wcif = await fetchWcaCompetition(
			competition.wcaCompetitionId,
			wcaToken,
		);

		if (!wcif) {
			return {
				success: false,
				error: "Failed to fetch WCIF from WCA",
			};
		}

		const [templateRounds, venueInfo] = await Promise.all([
			fetchIrelandTemplate(wcaToken),
			wcif.schedule.venues[0]
				? Promise.resolve(null)
				: fetchCompetitionVenueInfo(competition.wcaCompetitionId, wcaToken),
		]);

		const startDate = wcif.schedule.startDate;
		const day2 = wcif.schedule.numberOfDays > 1 ? getNextDay(startDate) : null;

		let activityId = 1;
		const { activities: saturdayActivities, nextId: nextId1 } =
			buildDayActivities(scheduleData.saturday, startDate, activityId);
		activityId = nextId1;

		const sundayActivities = day2
			? buildDayActivities(scheduleData.sunday, day2, activityId).activities
			: [];

		const allActivities = [...saturdayActivities, ...sundayActivities];

		const existingVenue = wcif.schedule.venues[0];
		const room = buildRoom(existingVenue, venueInfo, allActivities);
		const venue = buildVenue(existingVenue, venueInfo, room);

		const schedule: Schedule = {
			startDate,
			numberOfDays: wcif.schedule.numberOfDays,
			venues: [venue],
		};

		const events = buildEvents(allActivities, wcif.events, templateRounds);

		if (events.length === 0) {
			return {
				success: false,
				error:
					"No events with rounds found in schedule. Check that your sheet has valid event names.",
			};
		}

		const emptyRoundEvents = events.filter((e) => e.rounds.length === 0);
		if (emptyRoundEvents.length > 0) {
			return {
				success: false,
				error: `Events without rounds: ${emptyRoundEvents.map((e) => e.id).join(", ")}`,
			};
		}

		const result = await updateWcaSchedule(
			competition.wcaCompetitionId,
			wcaToken,
			{ id: wcif.id, events, schedule },
		);

		if (!result.success) {
			return result;
		}

		return { success: true, activitiesCreated: allActivities.length };
	},
});
