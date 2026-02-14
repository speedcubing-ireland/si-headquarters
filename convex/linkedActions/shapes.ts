import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
	linkedActionConfig,
	linkedActionRunPermission,
	linkedActionType,
	linkedTaskActionStatus,
} from "../lib/validators";

export const definitionShape = v.object({
	id: v.id("linkedActionDefinitions"),
	name: v.string(),
	shortId: v.string(),
	type: linkedActionType,
	runPermission: linkedActionRunPermission,
	config: linkedActionConfig,
	archived: v.boolean(),
	createdAt: v.number(),
	updatedAt: v.number(),
});

export const linkedTaskActionShape = v.object({
	id: v.id("taskLinkedActions"),
	taskId: v.id("tasks"),
	status: linkedTaskActionStatus,
	lastRunAt: v.union(v.number(), v.null()),
	lastRunMessage: v.union(v.string(), v.null()),
	lastOutputJson: v.union(v.string(), v.null()),
	canRun: v.boolean(),
	definition: definitionShape,
});

export const runContextShape = v.union(
	v.null(),
	v.object({
		taskLinkedActionId: v.id("taskLinkedActions"),
		task: v.object({
			id: v.id("tasks"),
			title: v.string(),
			parentCompetitionId: v.union(v.id("competitions"), v.null()),
		}),
		competitionName: v.union(v.string(), v.null()),
		definition: definitionShape,
	}),
);

export function toDefinitionView(definition: Doc<"linkedActionDefinitions">) {
	return {
		id: definition._id,
		name: definition.name,
		shortId: definition.shortId,
		type: definition.type,
		runPermission: definition.runPermission,
		config: definition.config,
		archived: definition.archived,
		createdAt: definition.createdAt,
		updatedAt: definition.updatedAt,
	};
}

export type RunnerContext = Exclude<Infer<typeof runContextShape>, null>;
