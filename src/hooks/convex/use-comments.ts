import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Comment, User } from "@/data/types-new";

export const useCommentsForTask = (
	taskId: Id<"tasks"> | Id<"competitionUpdates"> | null,
) => {
	const d = useQuery(
		api.comments.listForUI,
		taskId ? { parentType: "task", parentId: taskId } : "skip",
	);
	return { comments: d ?? [], isLoading: d === undefined };
};

export const useCommentsForSearch = () => {
	const d = useQuery(api.comments.listRecentForSearch, { limit: 200 });
	return { comments: d ?? [], isLoading: d === undefined };
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
