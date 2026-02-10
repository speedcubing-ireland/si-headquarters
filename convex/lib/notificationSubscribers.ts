import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getCommentParentId } from "./commentParentId";
import {
	matchesCompetitionViewFilters,
	matchesTaskViewFilters,
} from "./notificationViewMatchers";
import type {
	NotificationEntityRef,
	NotificationViewEntityType,
} from "./notificationTypes";

export async function resolveTaskForViewSubscription(
	ctx: MutationCtx,
	entity: NotificationEntityRef,
): Promise<Doc<"tasks"> | null> {
	if (entity.entityType === "task") {
		return ctx.db.get("tasks", entity.entityId);
	}

	if (entity.entityType === "comment") {
		if (entity.parentTaskId) {
			return ctx.db.get("tasks", entity.parentTaskId);
		}
		const comment = await ctx.db.get("comments", entity.entityId);
		if (!comment || comment.parentType !== "task") {
			return null;
		}
		return ctx.db.get("tasks", getCommentParentId("task", comment.parentId));
	}

	if (entity.entityType === "reminder") {
		if (entity.parentTaskId) {
			return ctx.db.get("tasks", entity.parentTaskId);
		}
		const reminder = await ctx.db.get("reminders", entity.entityId);
		if (!reminder) {
			return null;
		}
		return ctx.db.get("tasks", reminder.entityId);
	}

	return null;
}

export async function resolveCompetitionForViewSubscription(
	ctx: MutationCtx,
	entity: NotificationEntityRef,
): Promise<Doc<"competitions"> | null> {
	if (entity.entityType === "competition") {
		return ctx.db.get("competitions", entity.entityId);
	}

	if (entity.entityType !== "comment") {
		return null;
	}

	if (entity.parentTaskId) {
		return null;
	}

	const comment = await ctx.db.get("comments", entity.entityId);
	if (!comment || comment.parentType !== "update") {
		return null;
	}

	const update = await ctx.db.get(
		"competitionUpdates",
		getCommentParentId("update", comment.parentId),
	);
	if (!update) {
		return null;
	}
	return ctx.db.get("competitions", update.competitionId);
}

function viewEntitiesForNotificationEntity(
	entity: NotificationEntityRef,
): NotificationViewEntityType[] {
	switch (entity.entityType) {
		case "task":
		case "reminder":
			return ["tasks"];
		case "competition":
			return ["competitions"];
		case "comment":
			return entity.parentTaskId ? ["tasks"] : ["tasks", "competitions"];
	}
}

async function getCandidateViewSubscriptions(
	ctx: MutationCtx,
	entity: NotificationEntityRef,
): Promise<Doc<"notificationSubscriptions">[]> {
	const viewEntities = viewEntitiesForNotificationEntity(entity);
	if (viewEntities.length === 0) {
		return [];
	}

	const scopedSubscriptions = (
		await Promise.all(
			viewEntities.map((viewEntity) =>
				ctx.db
					.query("notificationSubscriptions")
					.withIndex("by_type_view_entity", (q) =>
						q.eq("subscriptionType", "view").eq("viewEntity", viewEntity),
					)
					.collect(),
			),
		)
	).flat();

	const legacySubscriptions = await ctx.db
		.query("notificationSubscriptions")
		.withIndex("by_type_view_entity", (q) =>
			q.eq("subscriptionType", "view").eq("viewEntity", undefined),
		)
		.collect();

	const deduped = new Map<
		Id<"notificationSubscriptions">,
		Doc<"notificationSubscriptions">
	>();
	for (const subscription of [...scopedSubscriptions, ...legacySubscriptions]) {
		deduped.set(subscription._id, subscription);
	}
	return [...deduped.values()];
}

export async function getViewSubscriberIds(
	ctx: MutationCtx,
	entity: NotificationEntityRef,
): Promise<Id<"users">[]> {
	const subscriptions = await getCandidateViewSubscriptions(ctx, entity);
	if (subscriptions.length === 0) {
		return [];
	}

	const viewCache = new Map<Id<"savedViews">, Doc<"savedViews"> | null>();
	const phaseCache = new Map<Id<"phases">, Doc<"phases"> | null>();
	const userCache = new Map<Id<"users">, Doc<"users"> | null>();

	let taskDoc: Doc<"tasks"> | null | undefined;
	let competitionDoc: Doc<"competitions"> | null | undefined;

	const recipientIds = new Set<Id<"users">>();

	const getUserName = async (
		userId: Id<"users">,
	): Promise<string | undefined> => {
		const cached = userCache.get(userId);
		if (cached !== undefined) {
			return cached?.name ?? undefined;
		}
		const user = await ctx.db.get("users", userId);
		userCache.set(userId, user);
		return user?.name ?? undefined;
	};

	const getPhaseKey = async (
		phaseId: Id<"phases"> | undefined,
	): Promise<string | undefined> => {
		if (!phaseId) {
			return undefined;
		}
		const cached = phaseCache.get(phaseId);
		if (cached !== undefined) {
			return cached?.key;
		}
		const phase = await ctx.db.get("phases", phaseId);
		phaseCache.set(phaseId, phase);
		return phase?.key;
	};

	const makeRefs = (
		id: string | undefined,
		name: string | undefined,
	): string[] => (id ? (name ? [id, name] : [id]) : []);

	for (const subscription of subscriptions) {
		if (subscription.subscriptionType !== "view" || !subscription.viewId) {
			continue;
		}

		const cachedView = viewCache.get(subscription.viewId);
		const view =
			cachedView !== undefined
				? cachedView
				: await ctx.db.get("savedViews", subscription.viewId);
		if (cachedView === undefined) {
			viewCache.set(subscription.viewId, view);
		}

		if (!view || view.userId !== subscription.userId) {
			continue;
		}

		if (view.entity === "tasks") {
			if (taskDoc === undefined) {
				taskDoc = await resolveTaskForViewSubscription(ctx, entity);
			}
			if (!taskDoc) {
				continue;
			}

			const matches = matchesTaskViewFilters(
				{
					status: taskDoc.status,
					priority: taskDoc.priority,
					assigneeIds: taskDoc.assigneeId ? [taskDoc.assigneeId] : [],
					labelIds: taskDoc.labelIds,
					ownerIds: taskDoc.ownerId ? [taskDoc.ownerId] : [],
					parentTypes: taskDoc.parentTaskId
						? ["task"]
						: taskDoc.parentCompetitionId
							? ["competition"]
							: [],
					dueDate: taskDoc.dueDate,
				},
				view.filtersJson,
			);
			if (matches) {
				recipientIds.add(subscription.userId);
			}
			continue;
		}

		if (competitionDoc === undefined) {
			competitionDoc = await resolveCompetitionForViewSubscription(ctx, entity);
		}
		if (!competitionDoc) {
			continue;
		}

		const phaseKey = await getPhaseKey(competitionDoc.currentPhaseId);
		const compLeadName = competitionDoc.compLeadId
			? await getUserName(competitionDoc.compLeadId)
			: undefined;
		const leadDelegateName = competitionDoc.leadDelegateId
			? await getUserName(competitionDoc.leadDelegateId)
			: undefined;

		const organiserRefs = (
			await Promise.all(
				competitionDoc.organiserIds.map(async (organiserId) => {
					const name = await getUserName(organiserId);
					return name ? [organiserId, name] : [organiserId];
				}),
			)
		).flat();

		const matches = matchesCompetitionViewFilters(
			{
				phaseKeys: phaseKey ? [phaseKey] : [],
				compLeadRefs: makeRefs(competitionDoc.compLeadId, compLeadName),
				leadDelegateRefs: makeRefs(
					competitionDoc.leadDelegateId,
					leadDelegateName,
				),
				organiserRefs,
				compStart: competitionDoc.compStart,
				compEnd: competitionDoc.compEnd,
			},
			view.filtersJson,
		);
		if (matches) {
			recipientIds.add(subscription.userId);
		}
	}

	return [...recipientIds];
}
