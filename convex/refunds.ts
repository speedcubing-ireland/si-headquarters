import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import {
	action,
	internalQuery,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireDirector } from "./admin";
import { buildRefundDecision, WCA_BASE_URL } from "./lib/refunds";
import { requireDirectorOrVolunteerAction } from "./lib/oauth";
import {
	isAcceptedRegistration,
	normalizeWcaId,
} from "./lib/wca/registrations";
import { getServiceAccessToken } from "./services/tokens/runtime";
import { createWcaClient } from "./services/wca/client";
import {
	getMyCompetitions,
	getRegistrationsAdmin,
} from "./services/wca/client/sdk.gen";

const WCA_ID_REGEX = /^\d{4}[A-Z]{4}\d{2}$/;
const RECENT_PAST_DAYS_WINDOW = 21;

const listVolunteerShape = v.object({
	id: v.id("refundVolunteers"),
	name: v.string(),
	wcaId: v.optional(v.string()),
	transferToWcaIds: v.array(v.string()),
	archived: v.boolean(),
});

const volunteerMatchStatusShape = v.union(
	v.literal("already_refunded"),
	v.literal("refund_due"),
);
const volunteerMatchShape = v.object({
	volunteerId: v.id("refundVolunteers"),
	name: v.string(),
	wcaId: v.optional(v.string()),
	transferToWcaIds: v.array(v.string()),
	matchedWcaIds: v.array(v.string()),
	status: volunteerMatchStatusShape,
	acceptedCount: v.number(),
	paidAcceptedCount: v.number(),
	unpaidAcceptedCount: v.number(),
	paidFirstNames: v.array(v.string()),
	paidComments: v.array(v.string()),
	paidAdminComments: v.array(v.string()),
	unpaidFirstNames: v.array(v.string()),
	unpaidComments: v.array(v.string()),
	unpaidAdminComments: v.array(v.string()),
	dueRegistrationId: v.union(v.number(), v.null()),
	dueRegistrationFirstName: v.union(v.string(), v.null()),
});

const competitionRefundStatusShape = v.union(
	volunteerMatchStatusShape,
	v.literal("no_eligible_volunteer"),
);

const competitionRefundSummaryShape = v.object({
	competitionId: v.string(),
	competitionName: v.string(),
	startDate: v.string(),
	endDate: v.string(),
	wcaUrl: v.string(),
	status: competitionRefundStatusShape,
	registrationCount: v.number(),
	acceptedRegistrationCount: v.number(),
	volunteerMatches: v.array(volunteerMatchShape),
	error: v.union(v.string(), v.null()),
});

const refundComputationResultShape = v.object({
	periodStartDate: v.string(),
	periodEndDate: v.string(),
	competitions: v.array(competitionRefundSummaryShape),
});

/** Single source of truth: types derived from validators (Convex pattern). */
export type RefundVolunteerRecord = Infer<typeof listVolunteerShape>;
export type RefundVolunteerMatch = Infer<typeof volunteerMatchShape>;
export type RefundCompetitionStatus = Infer<
	typeof competitionRefundStatusShape
>;
export type CompetitionRefundSummary = Infer<
	typeof competitionRefundSummaryShape
>;
export type RefundComputationResult = Infer<
	typeof refundComputationResultShape
>;

function normalizeVolunteerName(name: string): string {
	return name.trim();
}

function parseVolunteerWcaId(wcaId: string | undefined): string | undefined {
	if (!wcaId) return undefined;
	const normalized = normalizeWcaId(wcaId);
	if (!normalized) return undefined;
	if (!WCA_ID_REGEX.test(normalized)) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "WCA ID must be in format YYYYAAAA##.",
		});
	}
	return normalized;
}

function parseVolunteerWcaIdList(values: string[] | undefined): string[] {
	if (!values || values.length === 0) return [];
	const normalized = values.map((entry) => {
		const parsed = parseVolunteerWcaId(entry);
		if (!parsed) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: `Invalid WCA ID: ${entry}`,
			});
		}
		return parsed;
	});
	return [...new Set(normalized)];
}

function parseDateOnlyToUtcMs(value: string | null | undefined): number | null {
	const raw = (value ?? "").trim();
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	return Date.UTC(year, month - 1, day);
}

function formatDateOnlyUtc(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function sanitizeWcaErrorForUser(error: unknown): string {
	if (typeof error === "string") {
		return error;
	}
	if (error instanceof Error) {
		return error.message;
	}
	if (error && typeof error === "object") {
		const message = (error as { message?: unknown }).message;
		if (typeof message === "string" && message.trim()) {
			return message;
		}
		try {
			return JSON.stringify(error);
		} catch {
			return String(error);
		}
	}
	return String(error);
}

function getRecentPastWindow() {
	const todayUtc = new Date();
	todayUtc.setUTCHours(0, 0, 0, 0);
	const periodStartUtc = new Date(todayUtc.getTime());
	periodStartUtc.setUTCDate(
		periodStartUtc.getUTCDate() - RECENT_PAST_DAYS_WINDOW,
	);
	return {
		periodStartUtc,
		periodEndUtcExclusive: todayUtc,
	};
}

function mapVolunteerDoc(doc: {
	_id: Id<"refundVolunteers">;
	name: string;
	wcaId?: string;
	transferToWcaIds?: string[];
	archived: boolean;
}): RefundVolunteerRecord {
	return {
		id: doc._id,
		name: doc.name,
		wcaId: doc.wcaId,
		transferToWcaIds: parseVolunteerWcaIdList(doc.transferToWcaIds),
		archived: doc.archived,
	};
}

async function listOrderedVolunteers(ctx: QueryCtx | MutationCtx) {
	return await ctx.db
		.query("refundVolunteers")
		.withIndex("by_archived_name", (q) => q.eq("archived", false))
		.collect();
}

async function ensureUniqueVolunteerWcaId(
	ctx: QueryCtx | MutationCtx,
	wcaId: string | undefined,
	excludeId?: Id<"refundVolunteers">,
) {
	if (!wcaId) return;
	const existing = await ctx.db
		.query("refundVolunteers")
		.withIndex("by_wca_id", (q) => q.eq("wcaId", wcaId))
		.collect();
	const collision = existing.find(
		(doc) => !doc.archived && doc._id !== excludeId,
	);
	if (collision) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "A volunteer with this WCA ID already exists.",
		});
	}
}

export const listVolunteers = query({
	args: {},
	returns: v.array(listVolunteerShape),
	handler: async (ctx) => {
		await requireDirector(ctx);
		const docs = await listOrderedVolunteers(ctx);
		return docs.map(mapVolunteerDoc);
	},
});

export const listVolunteersInternal = internalQuery({
	args: {},
	returns: v.array(listVolunteerShape),
	handler: async (ctx) => {
		const docs = await listOrderedVolunteers(ctx);
		return docs.map(mapVolunteerDoc);
	},
});

export const createVolunteer = mutation({
	args: {
		name: v.string(),
		wcaId: v.optional(v.string()),
		transferToWcaIds: v.optional(v.array(v.string())),
	},
	returns: v.id("refundVolunteers"),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const name = normalizeVolunteerName(args.name);
		if (!name) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Volunteer name is required.",
			});
		}
		const wcaId = parseVolunteerWcaId(args.wcaId);
		const transferToWcaIds = parseVolunteerWcaIdList(args.transferToWcaIds);

		if (!wcaId && transferToWcaIds.length === 0) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message:
					"Either a WCA ID or at least one transfer WCA ID must be provided.",
			});
		}

		if (wcaId) {
			await ensureUniqueVolunteerWcaId(ctx, wcaId);
		}

		return await ctx.db.insert("refundVolunteers", {
			name,
			wcaId,
			transferToWcaIds,
			archived: false,
		});
	},
});

export const updateVolunteer = mutation({
	args: {
		id: v.id("refundVolunteers"),
		name: v.optional(v.string()),
		wcaId: v.optional(v.string()),
		transferToWcaIds: v.optional(v.array(v.string())),
		archived: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const doc = await ctx.db.get("refundVolunteers", args.id);
		if (!doc) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Volunteer not found.",
			});
		}

		const patch: {
			name?: string;
			wcaId?: string | undefined;
			transferToWcaIds?: string[];
			archived?: boolean;
		} = {};
		if (args.name !== undefined) {
			const name = normalizeVolunteerName(args.name);
			if (!name) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: "Volunteer name is required.",
				});
			}
			patch.name = name;
		}
		if (args.wcaId !== undefined) {
			const wcaId = parseVolunteerWcaId(args.wcaId);
			if (wcaId) {
				await ensureUniqueVolunteerWcaId(ctx, wcaId, args.id);
			}
			patch.wcaId = wcaId;
		}
		if (args.transferToWcaIds !== undefined) {
			patch.transferToWcaIds = parseVolunteerWcaIdList(args.transferToWcaIds);
		}
		if (args.archived !== undefined) {
			patch.archived = args.archived;
		}

		const finalWcaId = patch.wcaId ?? doc.wcaId;
		const finalTransferToWcaIds =
			patch.transferToWcaIds ?? doc.transferToWcaIds ?? [];
		if (!finalWcaId && finalTransferToWcaIds.length === 0) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message:
					"Either a WCA ID or at least one transfer WCA ID must be provided.",
			});
		}

		if (Object.keys(patch).length === 0) return null;
		await ctx.db.patch("refundVolunteers", args.id, patch);
		return null;
	},
});

export const deleteVolunteer = mutation({
	args: { id: v.id("refundVolunteers") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireDirector(ctx);
		const doc = await ctx.db.get("refundVolunteers", args.id);
		if (!doc) return null;
		await ctx.db.delete("refundVolunteers", args.id);
		return null;
	},
});

export const computeRefunds = action({
	args: {},
	returns: refundComputationResultShape,
	handler: async (ctx): Promise<RefundComputationResult> => {
		await requireDirectorOrVolunteerAction(ctx);

		const volunteerDocs: RefundVolunteerRecord[] = await ctx.runQuery(
			internal.refunds.listVolunteersInternal,
			{},
		);
		const activeVolunteerDocs: RefundVolunteerRecord[] = volunteerDocs.filter(
			(doc) => !doc.archived,
		);
		const volunteerById = new Map(
			activeVolunteerDocs.map((doc) => [String(doc.id), doc]),
		);

		const { periodStartUtc, periodEndUtcExclusive } = getRecentPastWindow();
		const periodStartMs = periodStartUtc.getTime();
		const periodEndMs = periodEndUtcExclusive.getTime();

		const wcaToken = await getServiceAccessToken(ctx, "wca");
		if (!wcaToken) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message:
					"No WCA token. Run bun run auth wca from repo root to connect.",
			});
		}
		const wcaClient = createWcaClient(wcaToken);
		const myCompetitionsResponse = await getMyCompetitions({
			client: wcaClient,
		});
		if (myCompetitionsResponse.error || !myCompetitionsResponse.data) {
			throw new ConvexError({
				code: "BAD_GATEWAY",
				message: `WCA my competitions failed: ${myCompetitionsResponse.error}`,
			});
		}

		const recentPastCompetitions = (
			myCompetitionsResponse.data.past_competitions ?? []
		).filter((competition) => {
			const endMs = parseDateOnlyToUtcMs(competition.end_date);
			if (endMs === null) return false;
			return endMs >= periodStartMs && endMs < periodEndMs;
		});
		const upcomingCompetitions =
			myCompetitionsResponse.data.future_competitions ?? [];
		const candidates = [...recentPastCompetitions, ...upcomingCompetitions];
		const uniqueById = new Map<string, (typeof candidates)[number]>();
		for (const competition of candidates) {
			if (!competition.id) continue;
			uniqueById.set(competition.id, competition);
		}

		const selectedCompetitions: Array<(typeof candidates)[number]> = Array.from(
			uniqueById.values(),
		).sort((left, right) =>
			(left.start_date ?? "").localeCompare(right.start_date ?? ""),
		);

		const competitionSummaries: Array<CompetitionRefundSummary | null> =
			await Promise.all(
				selectedCompetitions.map(
					async (competition): Promise<CompetitionRefundSummary | null> => {
						const competitionId = competition.id ?? "";
						const registrationResponse = await getRegistrationsAdmin({
							client: wcaClient,
							path: { competitionId },
						});

						if (registrationResponse.error) {
							return {
								competitionId,
								competitionName: competition.name ?? competitionId,
								startDate: competition.start_date ?? "",
								endDate: competition.end_date ?? "",
								wcaUrl: `${WCA_BASE_URL}/competitions/${encodeURIComponent(competitionId)}`,
								status: "no_eligible_volunteer" as const,
								registrationCount: 0,
								acceptedRegistrationCount: 0,
								volunteerMatches: [],
								error: `Failed to fetch registrations: ${sanitizeWcaErrorForUser(registrationResponse.error)}`,
							};
						}

						const registrations = Array.isArray(registrationResponse.data)
							? registrationResponse.data
							: [];
						const acceptedRegistrationCount = registrations.filter(
							isAcceptedRegistration,
						).length;
						const competitionStartMs = parseDateOnlyToUtcMs(
							competition.start_date,
						);
						const isFutureCompetition =
							competitionStartMs !== null && competitionStartMs >= periodEndMs;
						if (isFutureCompetition && acceptedRegistrationCount === 0) {
							return null;
						}
						const decision = buildRefundDecision({
							registrations,
							volunteers: activeVolunteerDocs.map((volunteer) => ({
								id: String(volunteer.id),
								name: volunteer.name,
								wcaId: volunteer.wcaId,
								transferToWcaIds: volunteer.transferToWcaIds,
							})),
						});

						return {
							competitionId,
							competitionName: competition.name ?? competitionId,
							startDate: competition.start_date ?? "",
							endDate: competition.end_date ?? "",
							wcaUrl: `${WCA_BASE_URL}/competitions/${encodeURIComponent(competitionId)}`,
							status: decision.status,
							registrationCount: registrations.length,
							acceptedRegistrationCount,
							volunteerMatches: decision.volunteerMatches
								.map((match) => {
									const volunteer = volunteerById.get(match.volunteerId);
									if (!volunteer) return null;
									return {
										volunteerId: volunteer.id,
										name: match.name,
										wcaId: match.wcaId,
										transferToWcaIds: match.transferToWcaIds,
										matchedWcaIds: match.matchedWcaIds,
										status: match.status,
										acceptedCount: match.acceptedCount,
										paidAcceptedCount: match.paidAcceptedCount,
										unpaidAcceptedCount: match.unpaidAcceptedCount,
										paidComments: match.paidComments,
										paidAdminComments: match.paidAdminComments,
										unpaidComments: match.unpaidComments,
										unpaidAdminComments: match.unpaidAdminComments,
										paidFirstNames: match.paidFirstNames,
										unpaidFirstNames: match.unpaidFirstNames,
										dueRegistrationId: match.dueRegistrationId,
										dueRegistrationFirstName: match.dueRegistrationFirstName,
									};
								})
								.filter(
									(entry): entry is NonNullable<typeof entry> => entry !== null,
								),
							error: null,
						};
					},
				),
			);
		const competitions: CompetitionRefundSummary[] =
			competitionSummaries.filter(
				(entry): entry is CompetitionRefundSummary => entry !== null,
			);

		return {
			periodStartDate: formatDateOnlyUtc(periodStartUtc),
			periodEndDate: formatDateOnlyUtc(periodEndUtcExclusive),
			competitions,
		};
	},
});
