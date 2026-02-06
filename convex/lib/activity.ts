import type { Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { activityMetadata } from "../lib/validators";
import type { ActivityType, ActivityEntity } from "./activityTypes";

type FieldConfig<T> = {
	type: ActivityType;
	transform?: (
		value: T[keyof T] | undefined,
		ctx: MutationCtx,
	) => Promise<string | undefined> | string | undefined;
};

export type ActivityConfig<D> = Partial<Record<keyof D, FieldConfig<D>>>;

type LogEntry = {
	type: ActivityType;
	oldValue?: string;
	newValue?: string;
};

export async function diffAndLog<T extends Record<string, unknown>>(
	ctx: MutationCtx,
	actorId: Id<"users">,
	entityType: ActivityEntity,
	entityId: string,
	oldDoc: T,
	updates: Partial<T>,
	config: ActivityConfig<T>,
): Promise<void> {
	const logEntries: LogEntry[] = [];

	for (const key in config) {
		const fieldConfig = config[key];
		if (!fieldConfig) continue;

		const oldValue = oldDoc[key];
		const newValue = updates[key];

		const isUpdated =
			(key as keyof T) in updates &&
			JSON.stringify(oldValue) !== JSON.stringify(newValue);

		if (isUpdated) {
			let oldString: string | undefined;
			let newString: string | undefined;

			if (fieldConfig.transform) {
				oldString = await fieldConfig.transform(oldValue, ctx);
				newString = await fieldConfig.transform(newValue, ctx);
			} else {
				oldString =
					oldValue === null || oldValue === undefined
						? undefined
						: String(oldValue);
				newString =
					newValue === null || newValue === undefined
						? undefined
						: String(newValue);
			}

			logEntries.push({
				type: fieldConfig.type,
				oldValue: oldString,
				newValue: newString,
			});
		}
	}

	if (logEntries.length > 0) {
		await Promise.all(
			logEntries.map((entry) =>
				ctx.runMutation(internal.activity.logWithActor, {
					actorId,
					entityType,
					entityId,
					type: entry.type,
					oldValue: entry.oldValue,
					newValue: entry.newValue,
				}),
			),
		);
	}
}

export async function diffLabels(
	ctx: MutationCtx,
	actorId: Id<"users">,
	entityType: ActivityEntity,
	entityId: string,
	oldLabelIds: Id<"labels">[] | undefined,
	newLabelIds: Id<"labels">[] | undefined,
): Promise<void> {
	if (!newLabelIds) return;

	const oldSet = new Set(oldLabelIds || []);
	const newSet = new Set(newLabelIds);

	const added = [...newSet].filter((id) => !oldSet.has(id));
	const removed = [...oldSet].filter((id) => !newSet.has(id));

	if (added.length === 0 && removed.length === 0) return;

	const allIds = [...added, ...removed];
	const uniqueIds = [...new Set(allIds)];
	const labelDocs = await Promise.all(
		uniqueIds.map((id) => ctx.db.get("labels", id)),
	);
	const idToName = new Map<string, string>();
	uniqueIds.forEach((id, i) => {
		const doc = labelDocs[i];
		if (doc) idToName.set(id, doc.name);
	});

	const promises: Promise<unknown>[] = [];

	for (const id of added) {
		promises.push(
			ctx.runMutation(internal.activity.logWithActor, {
				actorId,
				entityType,
				entityId,
				type: "label_added",
				newValue: idToName.get(id) ?? id,
			}),
		);
	}

	for (const id of removed) {
		promises.push(
			ctx.runMutation(internal.activity.logWithActor, {
				actorId,
				entityType,
				entityId,
				type: "label_removed",
				oldValue: idToName.get(id) ?? id,
			}),
		);
	}

	await Promise.all(promises);
}

export async function logActivity(
	ctx: MutationCtx,
	actorId: Id<"users">,
	entityType: ActivityEntity,
	entityId: string,
	type: ActivityType,
	metadata?: unknown,
): Promise<void> {
	await ctx.runMutation(internal.activity.logWithActor, {
		actorId,
		entityType,
		entityId,
		type,
		metadata: metadata as Infer<typeof activityMetadata>,
	});
}
