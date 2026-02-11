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

export const STANDARD_OTHER_ACTIVITIES: Record<string, string> = {
	registration: "other-registration",
	"registration opens": "other-registration",
	"registration open": "other-registration",
	"check in": "other-checkin",
	"check-in": "other-checkin",
	checkin: "other-checkin",
	"check-in opens": "other-checkin",
	"check-in closes": "other-checkin",
	lunch: "other-lunch",
	dinner: "other-dinner",
	breakfast: "other-breakfast",
	"coffee break": "other-misc-coffee-break",
	awards: "other-awards",
	"awards ceremony": "other-awards",
	"closing ceremony": "other-awards",
	"opening ceremony": "other-misc-opening-ceremony",
	ceremony: "other-misc-ceremony",
	"intro to competing": "other-tutorial",
	"competitor tutorial": "other-tutorial",
	"new competitor tutorial": "other-tutorial",
	briefing: "other-tutorial",
	"judges briefing": "other-tutorial",
	"scramblers briefing": "other-tutorial",
	break: "other-misc-break",
	setup: "other-setup",
	teardown: "other-teardown",
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

export function eventNameToActivityCode(
	name: string,
	round: number,
): string | null {
	const id = EVENT_NAME_TO_ID[normalize(name)];
	return id ? `${id}-r${round}` : null;
}

export function isOtherActivity(name: string): boolean {
	return !EVENT_NAME_TO_ID[normalize(name)];
}

export function otherActivityCode(name: string): string {
	const normalized = normalize(name);
	if (STANDARD_OTHER_ACTIVITIES[normalized]) {
		return STANDARD_OTHER_ACTIVITIES[normalized];
	}
	const suffix = normalized
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-+/g, "-");
	return suffix ? `other-misc-${suffix}` : "other-misc";
}

type SheetRow = {
	time: string;
	length: string;
	event: string;
	round: string;
};

function parseDuration(length: string): number {
	const parts = length.split(":").map(Number);
	return parts.length === 3
		? parts[0] * 60 + parts[1]
		: parts[0] * 60 + parts[1] || 0;
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

function buildActivities(
	rows: SheetRow[],
	dateStr: string,
	startId: number,
): { activities: Activity[]; nextId: number } {
	const activities: Activity[] = [];
	let id = startId;

	for (const row of rows) {
		const [hours, minutes] = row.time.split(":").map(Number);
		const durationMin = parseDuration(row.length);
		if (durationMin <= 0) continue;

		const startDate = new Date(`${dateStr}T00:00:00`);
		startDate.setHours(hours, minutes, 0, 0);
		const endDate = new Date(startDate.getTime() + durationMin * 60_000);

		const startTime = formatDublinTime(dateStr, hours, minutes);
		const endTime = formatDublinTime(
			dateStr,
			endDate.getHours(),
			endDate.getMinutes(),
		);
		const roundNum = Number.parseInt(row.round) || 1;
		const isEvent = !isOtherActivity(row.event);
		const activityCode = isEvent
			? (eventNameToActivityCode(row.event, roundNum) ??
				otherActivityCode(row.event))
			: otherActivityCode(row.event);
		const name = isEvent ? `${row.event}, Round ${roundNum}` : row.event;

		activities.push({
			id: id++,
			name,
			activityCode,
			startTime,
			endTime,
			childActivities: [],
			scrambleSetId: null,
			extensions: [],
		});
	}

	return { activities, nextId: id };
}

async function getGoogleAccessToken(
	ctx: GenericActionCtx<DataModel>,
): Promise<string | null> {
	const token = (await ctx.runQuery(
		internal.sheetsQueries.getGoogleSheetsToken,
		{},
	)) as {
		accessToken: string;
		refreshToken: string;
		expiresAt: number;
	} | null;
	if (!token) return null;

	const nowSec = Math.floor(Date.now() / 1000);
	if (token.expiresAt > nowSec + TOKEN_VALID_BUFFER_SEC)
		return token.accessToken;

	const clientId = process.env.AUTH_GOOGLE_ID;
	const clientSecret = process.env.AUTH_GOOGLE_SECRET;
	if (!clientId || !clientSecret) return token.accessToken;

	const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
	oauth2.setCredentials({
		access_token: token.accessToken,
		refresh_token: token.refreshToken,
	});
	const { credentials } = await oauth2.refreshAccessToken();

	if (credentials.access_token && credentials.expiry_date) {
		await ctx.runMutation(internal.sheetsQueries.setGoogleSheetsTokens, {
			accessToken: credentials.access_token,
			refreshToken: credentials.refresh_token ?? token.refreshToken,
			expiresAt: Math.floor(credentials.expiry_date / 1000),
		});
		return credentials.access_token;
	}
	return token.accessToken;
}

async function getWcaAccessToken(
	ctx: GenericActionCtx<DataModel>,
): Promise<string | null> {
	const token = (await ctx.runQuery(internal.wcaQueries.getWcaToken, {})) as {
		accessToken: string;
		refreshToken: string;
		expiresAt: number;
	} | null;
	if (!token) return null;

	const nowSec = Math.floor(Date.now() / 1000);
	if (token.expiresAt > nowSec + TOKEN_VALID_BUFFER_SEC)
		return token.accessToken;
	if (!token.refreshToken) return token.accessToken;

	const clientId = process.env.AUTH_WCA_ID;
	const clientSecret = process.env.AUTH_WCA_SECRET;
	if (!clientId || !clientSecret) return token.accessToken;

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

	if (!res.ok) return token.accessToken;

	const newTokens = (await res.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
		created_at?: number;
	};

	if (!newTokens.access_token) return token.accessToken;

	const expiresAt = newTokens.created_at
		? newTokens.created_at + (newTokens.expires_in ?? 7200)
		: Math.floor(Date.now() / 1000) + (newTokens.expires_in ?? 7200);

	await ctx.runMutation(internal.wcaQueries.setWcaTokens, {
		accessToken: newTokens.access_token,
		refreshToken: newTokens.refresh_token ?? token.refreshToken,
		expiresAt,
	});

	return newTokens.access_token;
}

async function fetchIrelandTemplate(
	wcaToken: string,
): Promise<WcifCompetition | null> {
	const res = await fetch(
		`${WCA_API}/competitions/${encodeURIComponent(IRELAND_TEMPLATE_COMPETITION_ID)}/wcif`,
		{ headers: { Authorization: `Bearer ${wcaToken}` } },
	);

	if (!res.ok) return null;

	return (await res.json()) as WcifCompetition;
}

export const pushScheduleToWca = action({
	args: { competitionId: v.id("competitions") },
	returns: v.object({
		success: v.boolean(),
		error: v.optional(v.string()),
		activitiesCreated: v.optional(v.number()),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		success: boolean;
		error?: string;
		activitiesCreated?: number;
	}> => {
		const isVol = await ctx.runQuery(internal.auth.getIsVolunteer, {});
		if (!isVol) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Volunteer access required",
			});
		}

		const comp = (await ctx.runQuery(internal.competitions.getInternal, {
			id: args.competitionId,
		})) as {
			wcaCompetitionId?: string;
			compSheet?: { sheetId: string };
			compStart: string;
			compEnd: string;
		} | null;
		if (!comp) return { success: false, error: "Competition not found" };
		if (!comp.wcaCompetitionId) {
			return {
				success: false,
				error: "Competition is not linked to WCA. Link it first.",
			};
		}
		if (!comp.compSheet) {
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

		const oauth2 = new google.auth.OAuth2();
		oauth2.setCredentials({ access_token: googleToken });
		const sheets = google.sheets({ version: "v4", auth: oauth2 });

		let satRows: string[][] = [];
		let sunRows: string[][] = [];

		try {
			const [satRes, sunRes] = await Promise.all([
				sheets.spreadsheets.values.get({
					spreadsheetId: comp.compSheet.sheetId,
					range: SATURDAY_RANGE,
				}),
				sheets.spreadsheets.values.get({
					spreadsheetId: comp.compSheet.sheetId,
					range: SUNDAY_RANGE,
				}),
			]);
			satRows = (satRes.data.values ?? []) as string[][];
			sunRows = (sunRes.data.values ?? []) as string[][];
		} catch (err) {
			return {
				success: false,
				error: `Failed to read sheet: ${err instanceof Error ? err.message : "Unknown error"}`,
			};
		}

		const satEntries = parseSheetRows(satRows);
		const sunEntries = parseSheetRows(sunRows);

		if (satEntries.length === 0 && sunEntries.length === 0) {
			return {
				success: false,
				error: "No schedule entries found in the sheet",
			};
		}

		const wcaToken = await getWcaAccessToken(ctx);
		if (!wcaToken)
			return { success: false, error: "No WCA token. Run: bun run auth:wca" };

		const wcifRes = await fetch(
			`${WCA_API}/competitions/${encodeURIComponent(comp.wcaCompetitionId)}/wcif`,
			{ headers: { Authorization: `Bearer ${wcaToken}` } },
		);

		if (!wcifRes.ok) {
			const text = await wcifRes.text();
			return {
				success: false,
				error: `Failed to fetch WCIF: ${wcifRes.status} ${text}`,
			};
		}

		const wcif = (await wcifRes.json()) as WcifCompetition;

		const irelandTemplate = await fetchIrelandTemplate(wcaToken);
		const templateRoundsMap = new Map<string, Round>();
		if (irelandTemplate) {
			for (const ev of irelandTemplate.events) {
				for (const round of ev.rounds) {
					templateRoundsMap.set(round.id, round);
				}
			}
			console.log(
				`Loaded ${templateRoundsMap.size} template rounds from IrelandTemplate2100`,
			);
		}

		const startDate = wcif.schedule.startDate;
		const numberOfDays = wcif.schedule.numberOfDays;
		const day1 = startDate;
		const day2 = numberOfDays > 1 ? getNextDay(startDate) : null;

		let activityId = 1;
		const { activities: satActivities, nextId: nextId1 } = buildActivities(
			satEntries,
			day1,
			activityId,
		);
		activityId = nextId1;

		let sunActivities: Activity[] = [];
		if (day2 && sunEntries.length > 0) {
			const result = buildActivities(sunEntries, day2, activityId);
			sunActivities = result.activities;
			activityId = result.nextId;
		}

		const allActivities = [...satActivities, ...sunActivities];
		const existingVenue = wcif.schedule.venues[0];
		let venueInfo: {
			name: string;
			lat: number;
			lng: number;
			country: string;
		} | null = null;

		if (!existingVenue) {
			const compInfoRes = await fetch(
				`${WCA_API}/competitions/${encodeURIComponent(comp.wcaCompetitionId!)}`,
				{ headers: { Authorization: `Bearer ${wcaToken}` } },
			);
			if (compInfoRes.ok) {
				const compInfo = (await compInfoRes.json()) as {
					venue?: string;
					latitude_degrees?: number;
					longitude_degrees?: number;
					country_iso2?: string;
				};
				venueInfo = {
					name: compInfo.venue ?? "Main Venue",
					lat: compInfo.latitude_degrees ?? 0,
					lng: compInfo.longitude_degrees ?? 0,
					country: compInfo.country_iso2 ?? "IE",
				};
			}
		}

		const room: Room = {
			id: existingVenue?.rooms?.[0]?.id ?? 1,
			name: existingVenue?.rooms?.[0]?.name ?? "Main Stage",
			color: existingVenue?.rooms?.[0]?.color ?? "#00897B",
			activities: allActivities,
			extensions: [],
		};

		const venue: Venue = existingVenue
			? { ...existingVenue, rooms: [room] }
			: {
					id: 1,
					name: venueInfo?.name ?? "Main Venue",
					latitudeMicrodegrees: Math.round((venueInfo?.lat ?? 0) * 1e6),
					longitudeMicrodegrees: Math.round((venueInfo?.lng ?? 0) * 1e6),
					countryIso2: venueInfo?.country ?? "IE",
					timezone: DUBLIN_TIMEZONE,
					rooms: [room],
					extensions: [],
				};

		const schedule: Schedule = {
			startDate,
			numberOfDays,
			venues: [venue],
		};

		const eventRoundsMap = new Map<string, Set<number>>();
		const eventAttemptCounts = new Map<string, number>();

		for (const activity of allActivities) {
			const match = activity.activityCode.match(/^([a-z0-9]+)-r(\d+)$/);
			if (!match) continue;
			const [, eventId, roundStr] = match;
			if (!eventId || !roundStr) continue;

			if (MULTI_ATTEMPT_EVENTS.has(eventId)) {
				const currentCount = eventAttemptCounts.get(eventId) || 0;
				eventAttemptCounts.set(eventId, currentCount + 1);
				if (!eventRoundsMap.has(eventId))
					eventRoundsMap.set(eventId, new Set());
				eventRoundsMap.get(eventId)!.add(1);
			} else {
				if (!eventRoundsMap.has(eventId))
					eventRoundsMap.set(eventId, new Set());
				eventRoundsMap.get(eventId)!.add(Number(roundStr));
			}
		}

		const existingEventsMap = new Map<string, Event>();
		for (const ev of wcif.events) existingEventsMap.set(ev.id, ev);

		const events: Event[] = [];
		for (const [eventId, roundNums] of eventRoundsMap) {
			const existingEvent = existingEventsMap.get(eventId);
			const sortedRounds = [...roundNums].sort((a, b) => a - b);
			const isMultiAttempt = MULTI_ATTEMPT_EVENTS.has(eventId);
			const attemptCount =
				eventAttemptCounts.get(eventId) || sortedRounds.length;

			const rounds: Round[] = sortedRounds.map((roundNum) => {
				const roundId = `${eventId}-r${roundNum}`;
				const existingRound = existingEvent?.rounds.find(
					(r) => r.id === roundId,
				);
				if (existingRound) return existingRound;

				const templateRound = templateRoundsMap.get(roundId);
				if (templateRound) {
					console.log(`Using Ireland template defaults for ${roundId}`);
					return {
						id: roundId,
						format: templateRound.format,
						timeLimit: templateRound.timeLimit,
						cutoff: templateRound.cutoff,
						advancementCondition: templateRound.advancementCondition,
						results: [],
						scrambleSetCount: templateRound.scrambleSetCount,
						extensions: [],
					} satisfies Round;
				}

				const format = isMultiAttempt
					? getRoundFormat(eventId, attemptCount)
					: getRoundFormat(eventId, 1);

				return {
					id: roundId,
					format,
					timeLimit: defaultTimeLimit(eventId),
					cutoff: null,
					advancementCondition: null,
					results: [],
					scrambleSetCount: 1,
					extensions: [],
				} satisfies Round;
			});

			events.push({
				id: eventId as EventId,
				rounds,
				extensions: existingEvent?.extensions ?? [],
				competitorLimit: existingEvent?.competitorLimit ?? null,
				qualification: existingEvent?.qualification ?? null,
			});
		}

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

		const patchBody = JSON.stringify({ id: wcif.id, events, schedule });
		const patchRes = await fetch(
			`${WCA_API}/competitions/${encodeURIComponent(comp.wcaCompetitionId)}/wcif`,
			{
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${wcaToken}`,
					"Content-Type": "application/json",
				},
				body: patchBody,
			},
		);

		if (!patchRes.ok) {
			const text = await patchRes.text();
			return {
				success: false,
				error: `WCA rejected WCIF update: ${patchRes.status} ${text}`,
			};
		}

		return { success: true, activitiesCreated: allActivities.length };
	},
});
