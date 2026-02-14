import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import {
	NotificationTemplates,
	type NotificationTemplateConfig,
} from "./notificationTemplates";
import { formatEntityTypeLabel } from "../../emails/shared";
import { parseEmailDispatchSnapshot } from "./notificationHelpers";
import { notificationType, notificationDigestMode } from "./validators";
import { EMAIL_CHANNEL, type NotificationType } from "./notificationTypes";

export function isDispatchDue(
	dispatch: Pick<Doc<"notificationDispatches">, "scheduledFor">,
	now: number,
): boolean {
	return dispatch.scheduledFor === undefined || dispatch.scheduledFor <= now;
}

export async function collectDispatchGroup(
	ctx: Pick<MutationCtx, "db">,
	seed: Doc<"notificationDispatches">,
): Promise<Doc<"notificationDispatches">[]> {
	if (seed.digestMode === "immediate") {
		return [seed];
	}

	return ctx.db
		.query("notificationDispatches")
		.withIndex("by_user_channel_mode_window_status", (q) =>
			q
				.eq("userId", seed.userId)
				.eq("channel", seed.channel)
				.eq("digestMode", seed.digestMode)
				.eq("digestWindowKey", seed.digestWindowKey)
				.eq("status", "pending"),
		)
		.collect();
}

export function humanizeNotificationType(type: string): string {
	return type
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export type ResolvedEmailDispatchItem = {
	dispatchId: Id<"notificationDispatches">;
	type: NotificationType;
	title: string;
	message: string;
	body?: string;
	entityType: string;
	entityId: string;
	parentEntityId?: string;
	priority: string;
	actorName?: string;
	sortTime: number;
};

export async function resolveEmailDispatchItem(
	ctx: Pick<QueryCtx, "db">,
	dispatch: Doc<"notificationDispatches">,
): Promise<ResolvedEmailDispatchItem | null> {
	const notification = dispatch.notificationId
		? await ctx.db.get("notifications", dispatch.notificationId)
		: null;
	if (notification) {
		return {
			dispatchId: dispatch._id,
			type: notification.type,
			title: notification.title,
			message: notification.message,
			body: notification.body,
			entityType: notification.entityType,
			entityId: notification.entityId,
			parentEntityId: notification.parentEntityId,
			priority: notification.priority,
			actorName: notification.metadata?.actorName,
			sortTime: notification._creationTime,
		};
	}

	const snapshot = parseEmailDispatchSnapshot(dispatch.metadataJson);
	if (snapshot) {
		return {
			dispatchId: dispatch._id,
			type: snapshot.type,
			title: snapshot.title,
			message: snapshot.message,
			body: snapshot.body,
			entityType: snapshot.entityType,
			entityId: snapshot.entityId,
			parentEntityId: snapshot.parentEntityId,
			priority: snapshot.priority,
			actorName: snapshot.actorName,
			sortTime: dispatch.updatedAt,
		};
	}

	const event = await ctx.db.get("notificationEvents", dispatch.eventId);
	if (!event) {
		return null;
	}

	const fallbackTitle = humanizeNotificationType(event.type);
	return {
		dispatchId: dispatch._id,
		type: event.type,
		title: fallbackTitle,
		message: `You have a new ${fallbackTitle.toLowerCase()} update.`,
		body: undefined,
		entityType: event.entityType,
		entityId: event.entityId,
		parentEntityId: undefined,
		priority: "normal",
		actorName: undefined,
		sortTime: event.createdAt,
	};
}

export async function patchPendingDispatches(
	ctx: MutationCtx,
	dispatchIds: Id<"notificationDispatches">[],
	status: "sent" | "failed",
	reason: string | undefined,
	claimKey: string | undefined,
): Promise<void> {
	const now = Date.now();
	for (const dispatchId of dispatchIds) {
		const dispatch = await ctx.db.get("notificationDispatches", dispatchId);
		if (
			!dispatch ||
			(dispatch.status !== "pending" && dispatch.status !== "sending") ||
			dispatch.channel !== EMAIL_CHANNEL ||
			(claimKey !== undefined && dispatch.reason !== claimKey)
		) {
			continue;
		}
		await ctx.db.patch("notificationDispatches", dispatch._id, {
			status,
			reason: status === "sent" ? undefined : reason,
			...(status === "sent" && { sentAt: now }),
			attempts: dispatch.attempts + 1,
			lastAttemptAt: now,
			scheduledFunctionId: undefined,
			updatedAt: now,
		});
	}
}

const demoTask = (
	n: string,
	identifier: string,
	title: string,
	priority: "low" | "medium" | "high" | "urgent" = "medium",
) => ({
	_id: `demo-task-${n}` as Id<"tasks">,
	identifier,
	title,
	priority,
});

const DEMO_TASKS = {
	task1: demoTask("1", "SI-42", "Design competition schedule layout", "high"),
	task2: demoTask("2", "SI-118", "Venue risk checklist"),
	task3: demoTask("3", "SI-201", "Supplier contract review", "high"),
	task4: demoTask("4", "SI-099", "Competitor confirmation emails"),
	task5: demoTask("5", "SI-311", "Final website review"),
	blockingTask: demoTask("6", "SI-180", "Supplier contract pending"),
};

const DEMO_COMPS = {
	comp1: {
		_id: "demo-comp-1" as Id<"competitions">,
		name: "Irish Open 2026",
	},
};

export function buildTestEmailData(appUrl: string, actorName: string) {
	const actor = { actorName };
	const t = DEMO_TASKS;
	const c = DEMO_COMPS;

	const immediateTemplate = NotificationTemplates.task_assigned(t.task1, actor);

	const taskLink = (task: { _id: string }) => `${appUrl}/tasks/${task._id}`;
	const compLink = (comp: { _id: string }) =>
		`${appUrl}/competitions/${comp._id}`;

	const hourlyTemplates = [
		{
			template: NotificationTemplates.comment_added(t.task2, actor),
			link: taskLink(t.task2),
		},
		{
			template: NotificationTemplates.task_status_changed(
				t.task4,
				actor,
				"to-do",
				"in-progress",
			),
			link: taskLink(t.task4),
		},
		{
			template: NotificationTemplates.task_priority_changed(
				t.task5,
				actor,
				"medium",
				"urgent",
			),
			link: taskLink(t.task5),
		},
	];

	const threeDailyTemplates = [
		{
			template: NotificationTemplates.relation_blocked(
				t.task3,
				t.blockingTask,
				actor,
			),
			link: taskLink(t.task3),
		},
		{
			template: NotificationTemplates.progress_update_added(
				c.comp1,
				actor,
				"at-risk",
			),
			link: compLink(c.comp1),
		},
		{
			template: NotificationTemplates.due_date_changed(
				t.task4,
				actor,
				"2026-03-15",
				"2026-03-19",
			),
			link: taskLink(t.task4),
		},
		{
			template: NotificationTemplates.task_approved(t.task5, actor),
			link: taskLink(t.task5),
		},
		{
			template: NotificationTemplates.competition_phase_changed(
				c.comp1,
				actor,
				"Planning",
				"Registration",
			),
			link: compLink(c.comp1),
		},
	];

	const mapItems = (
		entries: Array<{ template: NotificationTemplateConfig; link: string }>,
	) =>
		entries.map(({ template, link }) => ({
			title: template.title,
			message: template.message,
			entityType: formatEntityTypeLabel(template.entityType),
			priority: template.priority,
			actorName,
			link,
		}));

	return {
		immediate: {
			title: immediateTemplate.title,
			message: immediateTemplate.message,
			body: immediateTemplate.body,
			entityType: immediateTemplate.entityType,
			entityId: t.task1._id,
			parentEntityId: undefined,
			actorName,
			priority: immediateTemplate.priority,
		},
		hourly: mapItems(hourlyTemplates),
		threeDaily: mapItems(threeDailyTemplates),
	};
}

export const STALE_DISPATCH_THRESHOLD_MS = 10 * 60 * 1000;

export const emailDispatchItemValidator = v.object({
	dispatchId: v.id("notificationDispatches"),
	type: notificationType,
	title: v.string(),
	message: v.string(),
	body: v.optional(v.string()),
	entityType: v.string(),
	entityId: v.string(),
	parentEntityId: v.optional(v.string()),
	priority: v.string(),
	actorName: v.optional(v.string()),
});

export const emailDispatchGroupValidator = v.object({
	dispatchIds: v.array(v.id("notificationDispatches")),
	digestMode: notificationDigestMode,
	digestWindowKey: v.optional(v.string()),
	lastAttemptAt: v.optional(v.number()),
	recipientEmail: v.string(),
	recipientName: v.optional(v.string()),
	items: v.array(emailDispatchItemValidator),
});
