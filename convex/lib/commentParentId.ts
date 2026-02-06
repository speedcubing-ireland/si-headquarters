import type { Id } from "../_generated/dataModel";

type CommentParentId = Id<"tasks"> | Id<"competitionUpdates">;

/**
 * Boundary cast: comment schema stores parentId as v.string(); this helper
 * narrows to the correct Id type based on parentType so casts happen in one place.
 */
export function getCommentParentId(
	parentType: "task",
	parentId: string | CommentParentId,
): Id<"tasks">;
export function getCommentParentId(
	parentType: "update",
	parentId: string | CommentParentId,
): Id<"competitionUpdates">;
export function getCommentParentId(
	_parentType: "task" | "update",
	parentId: string | CommentParentId,
): CommentParentId {
	return parentId as CommentParentId;
}
