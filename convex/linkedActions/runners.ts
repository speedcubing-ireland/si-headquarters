import { ConvexError } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { api } from "../_generated/api";
import {
	canonicalizeCanvaConfig,
	isCanvaConfig,
	isLinkedSheetConfig,
} from "./config";
import type { RunnerContext } from "./shapes";
import { WCA_BASE_URL } from "../services/wca";

export type RunnerResult = {
	message: string;
	outputJson?: string;
};

type LinkedActionRunner = (
	ctx: ActionCtx,
	runContext: RunnerContext,
	args: { nameInput?: string; overwriteEvents?: boolean },
) => Promise<RunnerResult>;

function getParentName(runContext: RunnerContext): string {
	return runContext.competitionName ?? runContext.task.title;
}

const runCanvaTemplateAction: LinkedActionRunner = async (
	ctx,
	runContext,
	args,
) => {
	if (!isCanvaConfig(runContext.definition.config)) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Canva action config is invalid.",
		});
	}

	const parentName = getParentName(runContext);
	const configuredSuffix =
		runContext.definition.config.naming.defaultSuffix.trim();
	const userSuffix = args.nameInput?.trim();
	const suffix = userSuffix || configuredSuffix || "output";
	const outputTitle = `${parentName} - ${suffix}`;
	const canonicalConfig = canonicalizeCanvaConfig(runContext.definition.config);

	const result = await ctx.runAction(api.canva.runTemplateAction, {
		sourceBrandTemplateId: canonicalConfig.sourceBrandTemplateId,
		destinationFolderId: canonicalConfig.destinationFolderId,
		outputTitle,
		taskId: runContext.task.id,
		taskLinkedActionId: runContext.taskLinkedActionId,
	});
	const message = `Created Canva design "${result.title}". Open it, set link sharing as needed, then confirm sharing in this task.`;

	return {
		message,
		outputJson: JSON.stringify({
			...result,
			requiresManualShareConfirmation: true,
			manualShareConfirmed: false,
		}),
	};
};

const runLinkedSheetAction: LinkedActionRunner = async (
	ctx,
	runContext,
	args,
) => {
	if (!isLinkedSheetConfig(runContext.definition.config)) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Linked sheet action config is invalid.",
		});
	}

	switch (runContext.definition.config.operation) {
		case "populate_checkin_sheet": {
			const competitionId = runContext.task.parentCompetitionId;
			if (!competitionId) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message:
						"Task must belong to a competition to populate the check-in sheet.",
				});
			}

			const result = await ctx.runAction(
				api.wcaSchedule.populateCheckinSheetFromWca,
				{
					competitionId,
				},
			);
			if (!result.success) {
				const errorMessage =
					"error" in result
						? result.error
						: "Failed to populate check-in sheet.";
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: errorMessage,
				});
			}
			return {
				message: `Populated check-in sheet with ${result.rowsWritten} accepted registrations.`,
				outputJson: JSON.stringify(result),
			};
		}
		case "transfer_schedule_to_wca": {
			const competitionId = runContext.task.parentCompetitionId;
			if (!competitionId) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: "Task must belong to a competition to transfer schedule.",
				});
			}

			const result = await ctx.runAction(api.wcaSchedule.pushScheduleToWca, {
				competitionId,
				overwriteEvents: args.overwriteEvents,
			});
			if (!result.success) {
				const errorMessage =
					"error" in result ? result.error : "Failed to push schedule.";
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: errorMessage,
				});
			}

			const wcaCompetitionId = runContext.competition?.wcaCompetitionId;
			const eventsEditUrl = wcaCompetitionId
				? `${WCA_BASE_URL}/competitions/${wcaCompetitionId}/events/edit`
				: null;

			return {
				message: `Pushed ${result.activitiesCreated} activities to WCA. Please verify cutoffs and progressions are correct.`,
				outputJson: JSON.stringify({
					...result,
					eventsEditUrl,
					requiresManualEventsConfirmation: true,
					manualEventsConfirmed: false,
				}),
			};
		}
	}
};

export const runners: Record<
	Doc<"linkedActionDefinitions">["type"],
	LinkedActionRunner
> = {
	canva_template: runCanvaTemplateAction,
	linked_sheet: runLinkedSheetAction,
};
