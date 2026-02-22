import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Comment, User } from "@/data/types-new";
import { useRetainedQueryResult } from "./use-retained-query-result";

export const useCommentsForTask = (
	taskId: Id<"tasks"> | Id<"competitionUpdates"> | null,
) => {
	const result = useQuery(
		api.comments.listForUI,
		taskId ? { parentType: "task", parentId: taskId } : "skip",
	);
	const { data, isLoading, isRefreshing } = useRetainedQueryResult(
		result,
		taskId ?? "skip",
	);
	return {
		comments: data ?? [],
		isLoading: taskId !== null && isLoading,
		isRefreshing: taskId !== null && isRefreshing,
	};
};

export function useCommentMutations() {
	const createCommentMutation = useMutation(api.comments.create);
	const updateCommentMutation = useMutation(api.comments.update);
	const removeCommentMutation = useMutation(api.comments.remove);
	const toggleReactionMutation = useMutation(api.comments.toggleReaction);

	return {
		addComment: async (
			parentType: "task" | "update",
			parentId: Id<"tasks"> | Id<"competitionUpdates">,
			content: string,
			parentCommentId: Id<"comments"> | null,
			author: User,
		) => {
			const id = await createCommentMutation({
				parentType,
				parentId,
				parentCommentId: parentCommentId ?? undefined,
				content,
			});
			return {
				id,
				parentType,
				parentId,
				parentCommentId,
				author,
				content,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				contentUpdatedAt: undefined,
				reactions: [],
			} satisfies Comment;
		},
		editComment: (commentId: Id<"comments">, content: string) =>
			updateCommentMutation({ commentId, content }),
		deleteComment: (commentId: Id<"comments">) =>
			removeCommentMutation({ commentId }),
		addReaction: (commentId: Id<"comments">, emoji: string) =>
			toggleReactionMutation({ commentId, emoji }),
	};
}
