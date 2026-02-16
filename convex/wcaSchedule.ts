"use node";

import { action } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import type { GenericActionCtx } from "convex/server";
import { ConvexError, v } from "convex/values";
import { fromZonedTime } from "date-fns-tz";
import type {
	RegistrationDataV2,
	WcifActivity as Activity,
	WcifEvent as Event,
	WcifPerson,
	WcifRound as Round,
	WcifSchedule as Schedule,
	WcifVenue as Venue,
	WcifRoom as Room,
	WcifTimeLimit,
} from "./services/wca/client/types.gen";
import { createWcaClient } from "./services/wca/client";
import {
	competitionById,
	getCompetitionWcif,
	getRegistrationsAdmin,
	updateCompetitionWcif,
} from "./services/wca/client/sdk.gen";
import {
	clearGoogleSheetValues,
	fetchGoogleSheetValues,
	type GoogleSheetCellValue,
	shareGoogleSheetWithUser,
	updateGoogleSheetValues,
} from "./services/google/sheetsClient";

type WcaApiClient = ReturnType<typeof createWcaClient>;

const SATURDAY_RANGE = "Schedule!AH6:AK";
const SUNDAY_RANGE = "Schedule!AM6:AP";
const WCA_DATA_CLEAR_RANGE = "WCA Data!A3:U";
const WCA_DATA_WRITE_RANGE = "WCA Data!A3";
const LAPTOP_SHARE_EMAIL = "laptop@speedcubingireland.com";
const DUBLIN_TIMEZONE = "Europe/Dublin";
const IRELAND_TEMPLATE_COMPETITION_ID = "IrelandTemplate2100";
const CHECKIN_EVENT_COLUMNS = [
	"333",
	"222",
	"444",
	"555",
	"666",
	"777",
	"333bf",
	"333fm",
	"clock",
	"pyram",
	"skewb",
	"333mbf",
] as const;
const REGION_DISPLAY_NAMES =
	typeof Intl.DisplayNames === "function"
		? new Intl.DisplayNames(["en"], { type: "region" })
		: null;

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
	"333bf": "5",
	"666": "m",
	"777": "m",
	"444bf": "3",
	"555bf": "3",
};

export function getRoundFormat(
	eventId: string,
	attemptCount: number,
): "1" | "2" | "3" | "5" | "a" | "m" {
	const key = `${eventId}-${attemptCount}`;
	const format = ROUND_FORMATS[key] || ROUND_FORMATS[eventId];
	return (format as "1" | "2" | "3" | "5" | "a" | "m") || "a";
}

function defaultTimeLimit(eventId: string) {
	if (eventId === "333fm" || eventId === "333mbf") return undefined;
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

type PushScheduleResult =
	| { success: true; activitiesCreated: number }
	| { success: false; error: string };

type PopulateCheckinSheetResult =
	| { success: true; rowsWritten: number }
	| { success: false; error: string };
type ShareSheetWithLaptopsResult =
	| { success: true; sharedWith: string }
	| { success: false; error: string };

type CompetitionWcif = {
	id: string;
	events: Event[];
	schedule: Schedule;
	persons?: WcifPerson[];
};

async function getServiceAccessToken(
	ctx: GenericActionCtx<DataModel>,
	service: "google" | "wca",
): Promise<string | null> {
	return await ctx.runAction(internal.services.tokens.getValidAccessToken, {
		service,
	});
}

function parseDuration(length: string): number {
	const [hours = 0, minutes = 0] = length.split(":").map(Number);
	return (
		(Number.isFinite(hours) ? hours : 0) * 60 +
		(Number.isFinite(minutes) ? minutes : 0)
	);
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
	const [saturdayRows, sundayRows] = await Promise.all([
		fetchGoogleSheetValues({
			accessToken,
			spreadsheetId,
			range: SATURDAY_RANGE,
		}),
		fetchGoogleSheetValues({
			accessToken,
			spreadsheetId,
			range: SUNDAY_RANGE,
		}),
	]);

	return {
		saturday: parseSheetRows(saturdayRows),
		sunday: parseSheetRows(sundayRows),
	};
}

async function fetchCompetitionWcif(
	client: WcaApiClient,
	competitionId: string,
): Promise<CompetitionWcif | null> {
	const r = await getCompetitionWcif({
		client,
		path: { competitionId },
	});
	if (r.error || !r.data) return null;
	// WCA WCIF endpoint returns a full WCIF competition payload.
	return r.data as unknown as CompetitionWcif;
}

function firstNameFromFullName(name: string): string {
	const [firstName = ""] = name.trim().split(/\s+/);
	return firstName;
}

function buildWcifPersonLookup(persons: WcifPerson[] | undefined) {
	const byUserId = new Map<number, WcifPerson>();
	const byRegistrantId = new Map<number, WcifPerson>();

	for (const person of persons ?? []) {
		if (person.wcaUserId) {
			byUserId.set(person.wcaUserId, person);
		}
		if (person.registrantId) {
			byRegistrantId.set(person.registrantId, person);
		}
	}

	return { byUserId, byRegistrantId };
}

function resolvePersonForRegistration(
	registration: RegistrationDataV2,
	lookup: ReturnType<typeof buildWcifPersonLookup>,
): WcifPerson | undefined {
	return (
		lookup.byUserId.get(registration.user_id) ??
		lookup.byRegistrantId.get(registration.registrant_id)
	);
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function countryIso2ToName(countryIso2: string): string {
	const normalized = countryIso2.trim().toUpperCase();
	if (!normalized) return "";
	if (!REGION_DISPLAY_NAMES) return normalized;
	return REGION_DISPLAY_NAMES.of(normalized) ?? normalized;
}

export function getRegistrationStatus(
	registration: RegistrationDataV2,
): string {
	const competingRecord = registration.competing as Record<string, unknown>;
	const registrationRecord = registration as unknown as Record<string, unknown>;
	return (
		readString(competingRecord.registration_status) ??
		readString(competingRecord.status) ??
		readString(registrationRecord.registration_status) ??
		readString(registrationRecord.status) ??
		""
	).trim();
}

function isAcceptedRegistration(registration: RegistrationDataV2): boolean {
	return getRegistrationStatus(registration).toLowerCase() === "accepted";
}

function blankToNull(value: string | null | undefined): string | null {
	const normalized = (value ?? "").trim();
	return normalized ? normalized : null;
}

export function buildCheckinSheetRows(
	registrations: RegistrationDataV2[],
	wcifPersons: WcifPerson[] | undefined,
): GoogleSheetCellValue[][] {
	const collator = new Intl.Collator(undefined, { sensitivity: "base" });
	const personLookup = buildWcifPersonLookup(wcifPersons);

	const rows = registrations
		.filter(isAcceptedRegistration)
		.map((registration) => {
			const registrationStatus = getRegistrationStatus(registration);
			const name = (registration.user.name ?? "").trim();
			const firstName = firstNameFromFullName(name);
			const eventIds = new Set(registration.competing.event_ids ?? []);
			const person = resolvePersonForRegistration(registration, personLookup);

			return {
				firstName,
				name,
				sortKey: `${firstName} ${name}`.trim(),
				registrantId: registration.registrant_id,
				row: [
					blankToNull(registrationStatus),
					blankToNull(name),
					blankToNull(
						countryIso2ToName((registration.user.country_iso2 ?? "").trim()),
					),
					blankToNull(registration.user.wca_id),
					blankToNull(person?.birthdate),
					blankToNull(registration.user.gender),
					...CHECKIN_EVENT_COLUMNS.map((eventId) =>
						eventIds.has(eventId) ? ("1" as const) : null,
					),
					blankToNull(person?.email),
					typeof registration.guests === "number"
						? String(registration.guests)
						: null,
					null,
				],
			};
		});

	rows.sort((a, b) => {
		const firstNameCmp = collator.compare(a.firstName, b.firstName);
		if (firstNameCmp !== 0) return firstNameCmp;
		const nameCmp = collator.compare(a.name, b.name);
		if (nameCmp !== 0) return nameCmp;
		const sortKeyCmp = collator.compare(a.sortKey, b.sortKey);
		if (sortKeyCmp !== 0) return sortKeyCmp;
		return a.registrantId - b.registrantId;
	});

	return rows.map((entry) => entry.row);
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
		scrambleSetId: undefined,
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
	client: WcaApiClient,
	competitionId: string,
): Promise<CompetitionWcif | null> {
	return fetchCompetitionWcif(client, competitionId);
}

async function fetchIrelandTemplate(
	client: WcaApiClient,
): Promise<Map<string, Round>> {
	const wcif = await fetchCompetitionWcif(
		client,
		IRELAND_TEMPLATE_COMPETITION_ID,
	);
	if (!wcif) return new Map();
	return new Map(
		wcif.events.flatMap((event) =>
			event.rounds.map((round) => [round.id, round] as const),
		),
	);
}

async function fetchCompetitionVenueInfo(
	client: WcaApiClient,
	competitionId: string,
): Promise<{
	name: string;
	detail: string;
	lat: number;
	lng: number;
	country: string;
} | null> {
	const r = await competitionById({
		client,
		path: { competitionId },
	});
	if (r.error || !r.data) return null;
	const info = r.data;
	return {
		name: info.venue ?? "Main Venue",
		detail: info.venue_details ?? "Main Stage",
		lat: info.latitude_degrees ?? 0,
		lng: info.longitude_degrees ?? 0,
		country: info.country_iso2 ?? "IE",
	};
}

async function updateWcaSchedule(
	client: WcaApiClient,
	competitionId: string,
	wcif: CompetitionWcif,
): Promise<{ success: true } | { success: false; error: string }> {
	/**
	 * WCA's WCIF update endpoint accepts a full WCIF competition payload.
	 * The current OpenAPI schema models this body more narrowly.
	 */
	const body = wcif as unknown as Parameters<
		typeof updateCompetitionWcif
	>[0]["body"];
	const r = await updateCompetitionWcif({
		client,
		path: { competitionId },
		body,
	});
	if (r.error) {
		return {
			success: false as const,
			error: `WCA rejected WCIF update: ${JSON.stringify(r.error)}`,
		};
	}
	return { success: true as const };
}

function buildCompetitionActivities(
	scheduleData: { saturday: SheetRow[]; sunday: SheetRow[] },
	startDate: string,
	numberOfDays: number,
): Activity[] {
	const daySchedules: Array<{ rows: SheetRow[]; date: string }> = [
		{ rows: scheduleData.saturday, date: startDate },
	];
	if (numberOfDays > 1) {
		daySchedules.push({
			rows: scheduleData.sunday,
			date: getNextDay(startDate),
		});
	}

	let nextId = 1;
	const allActivities: Activity[] = [];
	for (const daySchedule of daySchedules) {
		const built = buildDayActivities(
			daySchedule.rows,
			daySchedule.date,
			nextId,
		);
		allActivities.push(...built.activities);
		nextId = built.nextId;
	}
	return allActivities;
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
			scrambleSets: templateRound.scrambleSets ?? [],
			extensions: [],
		};
	}

	const format = getRoundFormat(eventId, isMultiAttempt ? attemptCount : 1);
	const timeLimit: WcifTimeLimit | undefined = defaultTimeLimit(eventId);

	return {
		id: roundId,
		format,
		timeLimit,
		cutoff: undefined,
		advancementCondition: undefined,
		results: [],
		scrambleSetCount: 1,
		scrambleSets: [],
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
		const existingEvent = existingEventsMap.get(eventId);
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
			id: eventId,
			rounds,
			extensions: existingEvent?.extensions ?? [],
			competitorLimit: existingEvent?.competitorLimit,
			qualification: existingEvent?.qualification,
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
	returns: v.union(
		v.object({
			success: v.literal(true),
			activitiesCreated: v.number(),
		}),
		v.object({
			success: v.literal(false),
			error: v.string(),
		}),
	),
	handler: async (ctx, args): Promise<PushScheduleResult> => {
		const competitionForUser = await ctx.runQuery(api.competitions.get, {
			competitionId: args.competitionId,
		});
		if (!competitionForUser) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You do not have access to this competition.",
			});
		}

		const competition = (await ctx.runQuery(internal.competitions.getInternal, {
			id: args.competitionId,
		})) as CompetitionInfo | null;

		if (!competition) {
			return { success: false as const, error: "Competition not found" };
		}

		if (!competition.wcaCompetitionId) {
			return {
				success: false as const,
				error: "Competition is not linked to WCA. Link it first.",
			};
		}

		if (!competition.compSheet) {
			return {
				success: false as const,
				error:
					"No Google Sheet linked. Add a sheet with a Schedule page first.",
			};
		}

		const googleToken = await getServiceAccessToken(ctx, "google");
		if (!googleToken) {
			return {
				success: false as const,
				error: "No Google Sheets token. Run: bun run auth google-sheets",
			};
		}

		const wcaToken = await getServiceAccessToken(ctx, "wca");
		if (!wcaToken) {
			return {
				success: false as const,
				error: "No WCA token. Run: bun run auth wca",
			};
		}
		const wcaClient = createWcaClient(wcaToken);

		let scheduleData: { saturday: SheetRow[]; sunday: SheetRow[] };
		try {
			scheduleData = await fetchScheduleFromSheets(
				competition.compSheet.sheetId,
				googleToken,
			);
		} catch (err) {
			return {
				success: false as const,
				error: `Failed to read sheet: ${err instanceof Error ? err.message : "Unknown error"}`,
			};
		}

		if (
			scheduleData.saturday.length === 0 &&
			scheduleData.sunday.length === 0
		) {
			return {
				success: false as const,
				error: "No schedule entries found in the sheet",
			};
		}

		const wcif = await fetchWcaCompetition(
			wcaClient,
			competition.wcaCompetitionId,
		);

		if (!wcif) {
			return {
				success: false as const,
				error: "Failed to fetch WCIF from WCA",
			};
		}

		const [templateRounds, venueInfo] = await Promise.all([
			fetchIrelandTemplate(wcaClient),
			wcif.schedule.venues[0]
				? Promise.resolve(null)
				: fetchCompetitionVenueInfo(wcaClient, competition.wcaCompetitionId),
		]);

		const startDate = wcif.schedule.startDate;
		const allActivities = buildCompetitionActivities(
			scheduleData,
			startDate,
			wcif.schedule.numberOfDays,
		);

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
				success: false as const,
				error:
					"No events with rounds found in schedule. Check that your sheet has valid event names.",
			};
		}

		const emptyRoundEvents = events.filter((e) => e.rounds.length === 0);
		if (emptyRoundEvents.length > 0) {
			return {
				success: false as const,
				error: `Events without rounds: ${emptyRoundEvents.map((e) => e.id).join(", ")}`,
			};
		}

		const result = await updateWcaSchedule(
			wcaClient,
			competition.wcaCompetitionId,
			{
				id: wcif.id,
				events,
				schedule,
			},
		);

		if (!result.success) {
			return result;
		}

		return { success: true as const, activitiesCreated: allActivities.length };
	},
});

export const populateCheckinSheetFromWca = action({
	args: { competitionId: v.id("competitions") },
	returns: v.union(
		v.object({
			success: v.literal(true),
			rowsWritten: v.number(),
		}),
		v.object({
			success: v.literal(false),
			error: v.string(),
		}),
	),
	handler: async (ctx, args): Promise<PopulateCheckinSheetResult> => {
		const competitionForUser = await ctx.runQuery(api.competitions.get, {
			competitionId: args.competitionId,
		});
		if (!competitionForUser) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You do not have access to this competition.",
			});
		}

		const competition = (await ctx.runQuery(internal.competitions.getInternal, {
			id: args.competitionId,
		})) as CompetitionInfo | null;

		if (!competition) {
			return { success: false as const, error: "Competition not found" };
		}

		if (!competition.wcaCompetitionId) {
			return {
				success: false as const,
				error: "Competition is not linked to WCA. Link it first.",
			};
		}

		if (!competition.compSheet) {
			return {
				success: false as const,
				error: "No Google Sheet linked. Add a Google Sheet first.",
			};
		}

		const googleToken = await getServiceAccessToken(ctx, "google");
		if (!googleToken) {
			return {
				success: false as const,
				error: "No Google Sheets token. Run: bun run auth google-sheets",
			};
		}

		const wcaToken = await getServiceAccessToken(ctx, "wca");
		if (!wcaToken) {
			return {
				success: false as const,
				error: "No WCA token. Run: bun run auth wca",
			};
		}
		const wcaClient = createWcaClient(wcaToken);

		const registrationsResponse = await getRegistrationsAdmin({
			client: wcaClient,
			path: { competitionId: competition.wcaCompetitionId },
		});
		if (registrationsResponse.error) {
			return {
				success: false as const,
				error: `Failed to fetch admin competition registrations: ${JSON.stringify(registrationsResponse.error)}`,
			};
		}

		const registrations = Array.isArray(registrationsResponse.data)
			? registrationsResponse.data
			: [];
		const hasStatusFields = registrations.some(
			(registration) => getRegistrationStatus(registration) !== "",
		);
		if (registrations.length > 0 && !hasStatusFields) {
			return {
				success: false as const,
				error:
					"WCA admin registrations are missing status fields. Ensure your WCA token has organizer/delegate access for this competition.",
			};
		}
		const wcif = await fetchCompetitionWcif(
			wcaClient,
			competition.wcaCompetitionId,
		);
		const rows = buildCheckinSheetRows(registrations, wcif?.persons);

		try {
			await clearGoogleSheetValues({
				accessToken: googleToken,
				spreadsheetId: competition.compSheet.sheetId,
				range: WCA_DATA_CLEAR_RANGE,
			});
			if (rows.length > 0) {
				await updateGoogleSheetValues({
					accessToken: googleToken,
					spreadsheetId: competition.compSheet.sheetId,
					range: WCA_DATA_WRITE_RANGE,
					values: rows,
				});
			}
		} catch (err) {
			return {
				success: false as const,
				error: `Failed to update check-in sheet: ${err instanceof Error ? err.message : "Unknown error"}`,
			};
		}

		return {
			success: true as const,
			rowsWritten: rows.length,
		};
	},
});

export const shareSheetWithLaptops = action({
	args: { competitionId: v.id("competitions") },
	returns: v.union(
		v.object({
			success: v.literal(true),
			sharedWith: v.string(),
		}),
		v.object({
			success: v.literal(false),
			error: v.string(),
		}),
	),
	handler: async (ctx, args): Promise<ShareSheetWithLaptopsResult> => {
		const competitionForUser = await ctx.runQuery(api.competitions.get, {
			competitionId: args.competitionId,
		});
		if (!competitionForUser) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You do not have access to this competition.",
			});
		}

		const competition = (await ctx.runQuery(internal.competitions.getInternal, {
			id: args.competitionId,
		})) as CompetitionInfo | null;

		if (!competition) {
			return { success: false as const, error: "Competition not found" };
		}
		if (!competition.compSheet) {
			return {
				success: false as const,
				error: "No Google Sheet linked. Add a Google Sheet first.",
			};
		}

		const googleToken = await getServiceAccessToken(ctx, "google");
		if (!googleToken) {
			return {
				success: false as const,
				error: "No Google Sheets token. Run: bun run auth google-sheets",
			};
		}

		try {
			await shareGoogleSheetWithUser({
				accessToken: googleToken,
				spreadsheetId: competition.compSheet.sheetId,
				email: LAPTOP_SHARE_EMAIL,
				role: "writer",
				notificationMessage:
					"A Speedcubing Ireland competition sheet has been shared with this address for laptop check-in support.",
			});
		} catch (err) {
			return {
				success: false as const,
				error: `Failed to share sheet with laptops: ${err instanceof Error ? err.message : "Unknown error"}`,
			};
		}

		return { success: true as const, sharedWith: LAPTOP_SHARE_EMAIL };
	},
});
