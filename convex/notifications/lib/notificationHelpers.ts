import { ConvexError } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { NOTIFICATION_LIST_LIMITS, MINUTES_IN_DAY } from "../../lib/constants";
import { validateQuietHoursWindow } from "./notificationScheduling";
import { toISO } from "../../lib/transforms";
import type {
	DispatchStatus,
	EmailDispatchSnapshot,
	NotificationEntityRef,
	NotificationPayload,
} from "./notificationTypes";
import {
	DEFAULT_SUBSCRIPTION_LIST_LIMIT,
	MAX_SUBSCRIPTION_LIST_LIMIT,
} from "./notificationTypes";

export const optionalIso = (ts?: number) =>
	ts !== undefined ? toISO(ts) : undefined;

export function docToNotification(d: Doc<"notifications">) {
	return {
		id: d._id,
		userId: d.userId,
		type: d.type,
		priority: d.priority,
		status: d.status,
		title: d.title,
		message: d.message,
		body: d.body,
		entityType: d.entityType,
		entityId: d.entityId,
		parentEntityId: d.parentEntityId,
		metadata: d.metadata ?? {},
		sourceEventId: d.sourceEventId,
		threadKey: d.threadKey,
		dedupeKey: d.dedupeKey,
		createdAt: toISO(d._creationTime),
		readAt: optionalIso(d.readAt),
		archivedAt: optionalIso(d.archivedAt),
		snoozedUntil: optionalIso(d.snoozedUntil),
		scheduledFor: optionalIso(d.scheduledFor),
		isBatchable: d.isBatchable,
		batchKey: d.batchKey,
	};
}

export function clampLimit(
	limit: number | undefined,
	defaultVal: number,
	max: number,
): number {
	if (!limit || Number.isNaN(limit)) return defaultVal;
	if (limit < 1) return 1;
	if (limit > max) return max;
	return limit;
}

export const normalizeListLimit = (limit?: number) =>
	clampLimit(
		limit,
		NOTIFICATION_LIST_LIMITS.DEFAULT,
		NOTIFICATION_LIST_LIMITS.MAX,
	);

export const normalizeSubscriptionListLimit = (limit?: number) =>
	clampLimit(
		limit,
		DEFAULT_SUBSCRIPTION_LIST_LIMIT,
		MAX_SUBSCRIPTION_LIST_LIMIT,
	);

export function isNotificationScheduledVisible(
	doc: Pick<Doc<"notifications">, "scheduledFor">,
	now: number,
): boolean {
	return doc.scheduledFor === undefined || doc.scheduledFor <= now;
}

export function isUnreadNotificationVisible(
	doc: Pick<Doc<"notifications">, "scheduledFor" | "snoozedUntil">,
	now: number,
): boolean {
	return (
		(doc.snoozedUntil === undefined || doc.snoozedUntil <= now) &&
		isNotificationScheduledVisible(doc, now)
	);
}

export async function paginatedFilter<T>(
	paginate: (
		cursor: string | null,
	) => Promise<{ page: T[]; isDone: boolean; continueCursor: string }>,
	filter: (doc: T) => boolean,
	limit: number,
): Promise<T[]> {
	const results: T[] = [];
	let cursor: string | null = null;
	while (results.length < limit) {
		const page = await paginate(cursor);
		for (const doc of page.page) {
			if (filter(doc)) {
				results.push(doc);
				if (results.length >= limit) break;
			}
		}
		if (page.isDone) break;
		cursor = page.continueCursor;
	}
	return results;
}

export async function paginatedCount<T>(
	paginate: (
		cursor: string | null,
	) => Promise<{ page: T[]; isDone: boolean; continueCursor: string }>,
	filter?: (doc: T) => boolean,
): Promise<number> {
	let count = 0;
	let cursor: string | null = null;
	while (true) {
		const page = await paginate(cursor);
		count += filter ? page.page.filter(filter).length : page.page.length;
		if (page.isDone) break;
		cursor = page.continueCursor;
	}
	return count;
}

export async function listVisibleNotificationsForUser(
	ctx: QueryCtx,
	userId: Id<"users">,
	now: number,
	limit: number,
): Promise<Doc<"notifications">[]> {
	const pageSize = Math.min(
		Math.max(limit * 2, NOTIFICATION_LIST_LIMITS.DEFAULT),
		NOTIFICATION_LIST_LIMITS.MAX,
	);
	return paginatedFilter(
		(cursor) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.order("desc")
				.paginate({ cursor, numItems: pageSize }),
		(doc) => isNotificationScheduledVisible(doc, now),
		limit,
	);
}

export async function countVisibleUnreadNotifications(
	ctx: QueryCtx,
	userId: Id<"users">,
	now: number,
): Promise<number> {
	return paginatedCount(
		(cursor) =>
			ctx.db
				.query("notifications")
				.withIndex("by_user_and_status", (q) =>
					q.eq("userId", userId).eq("status", "unread"),
				)
				.paginate({ cursor, numItems: NOTIFICATION_LIST_LIMITS.MAX }),
		(doc) => isUnreadNotificationVisible(doc, now),
	);
}

export async function countDispatchesByStatus(
	ctx: QueryCtx,
	userId: Id<"users">,
	status: DispatchStatus,
): Promise<number> {
	return paginatedCount((cursor) =>
		ctx.db
			.query("notificationDispatches")
			.withIndex("by_user_status", (q) =>
				q.eq("userId", userId).eq("status", status),
			)
			.paginate({ cursor, numItems: NOTIFICATION_LIST_LIMITS.MAX }),
	);
}

function validateQuietHour(value: number | undefined, fieldName: string): void {
	if (value === undefined) return;
	const maxMinute = MINUTES_IN_DAY - 1;
	if (!Number.isInteger(value) || value < 0 || value > maxMinute) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `${fieldName} must be an integer between 0 and ${maxMinute}`,
		});
	}
}

export function validateQuietHours(
	quietHoursStartMin: number | undefined,
	quietHoursEndMin: number | undefined,
): void {
	validateQuietHour(quietHoursStartMin, "quietHoursStartMin");
	validateQuietHour(quietHoursEndMin, "quietHoursEndMin");
	validateQuietHoursWindow(quietHoursStartMin, quietHoursEndMin);
}

export function serializePayload(
	payload: NotificationPayload,
): string | undefined {
	const normalized: Record<string, string | number | boolean | null> = {};
	for (const [key, value] of Object.entries(payload)) {
		if (value !== undefined) {
			normalized[key] = value;
		}
	}
	if (Object.keys(normalized).length === 0) {
		return undefined;
	}
	return JSON.stringify(normalized);
}

export function parseEmailDispatchSnapshot(
	metadataJson: string | undefined,
): EmailDispatchSnapshot | null {
	if (!metadataJson) return null;

	try {
		const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
		if (!parsed || typeof parsed !== "object") return null;
		const required = [
			"type",
			"title",
			"message",
			"entityType",
			"entityId",
			"priority",
		] as const;
		if (required.some((k) => typeof parsed[k] !== "string")) return null;
		const optional = ["body", "parentEntityId", "actorName"] as const;
		if (
			optional.some(
				(k) => parsed[k] !== undefined && typeof parsed[k] !== "string",
			)
		)
			return null;
		return {
			type: parsed.type as EmailDispatchSnapshot["type"],
			title: parsed.title as string,
			message: parsed.message as string,
			entityType: parsed.entityType as EmailDispatchSnapshot["entityType"],
			entityId: parsed.entityId as string,
			priority: parsed.priority as EmailDispatchSnapshot["priority"],
			body: parsed.body as string | undefined,
			parentEntityId: parsed.parentEntityId as string | undefined,
			actorName: parsed.actorName as string | undefined,
		};
	} catch {
		return null;
	}
}

export function notificationParentEntityId(
	entity: NotificationEntityRef,
): string | undefined {
	if (entity.entityType === "comment" || entity.entityType === "reminder") {
		return entity.parentTaskId;
	}
	return undefined;
}

export function defaultThreadKey(entity: NotificationEntityRef): string {
	if (
		(entity.entityType === "comment" || entity.entityType === "reminder") &&
		entity.parentTaskId
	) {
		return `task:${entity.parentTaskId}`;
	}
	return `${entity.entityType}:${entity.entityId}`;
}
