import type { Id } from "../_generated/dataModel";

type CommentParentId = Id<"tasks"> | Id<"competitionUpdates">;

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
