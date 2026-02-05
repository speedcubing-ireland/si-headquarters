import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { computeApprovalCompleteness } from "./taskApprovals";

/**
 * Build a task patch from an updates object: spread updates, set updatedAt,
 * and convert optional null fields to undefined so Convex clears them.
 */
export function buildTaskPatch(
	updates: Record<string, unknown>,
	updatedAt: number,
): Record<string, unknown> {
	const patch: Record<string, unknown> = { ...updates, updatedAt };
	if (updates.dueDate === null) patch.dueDate = undefined;
	if (updates.parentTaskId === null) patch.parentTaskId = undefined;
	if (updates.parentCompetitionId === null)
		patch.parentCompetitionId = undefined;
	if (updates.ownerId === null) patch.ownerId = undefined;
	if (updates.assigneeId === null) patch.assigneeId = undefined;
	if (updates.phaseId === null) patch.phaseId = undefined;
	return patch;
}

/**
 * If patch.status is "awaiting-review", check approval completeness and
 * set patch.status to "done" when already fully approved (so the transition
 * is a no-op for the user).
 */
export async function applyAwaitingReviewAutoPromote(
	ctx: MutationCtx,
	doc: Doc<"tasks">,
	patch: Record<string, unknown>,
): Promise<void> {
	if (patch.status !== "awaiting-review") return;
	const { isFullyApproved } = await computeApprovalCompleteness(
		ctx,
		doc.requiredApprovalIds ?? [],
		doc.approvedByIds ?? [],
	);
	if (
		isFullyApproved &&
		doc.requiredApprovalIds &&
		doc.requiredApprovalIds.length > 0
	) {
		patch.status = "done";
	}
}
