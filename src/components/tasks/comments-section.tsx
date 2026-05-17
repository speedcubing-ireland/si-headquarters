import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	useUsers,
	useCommentsForTask,
	useCommentMutations,
} from "@/hooks/use-convex-data";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { parseCommentId } from "@/lib/convex-ids";
import { useDebouncedForm } from "@/hooks/use-debounced-form";
import type { Comment, User } from "@/data/types-new";
import { formatDate, getInitials } from "@/lib/format-utils";
import { cn, onMutationError } from "@/lib/utils";
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";
import {
	ReactionButton,
	ReactionDisplay,
} from "@/components/shared/reaction-button";
import {
	CornerDownRight,
	Edit2,
	MessageCircle,
	MoreHorizontal,
	Reply,
	Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MentionTextarea } from "@/components/shared/mention-textarea";

interface CommentItemProps {
	comment: Comment;
	allComments: Comment[];
	depth?: number;
	currentUser?: User;
	users: User[];
	onReply: (parentCommentId: Id<"comments">, content: string) => void;
	onEdit: (commentId: Id<"comments">, content: string) => void;
	onDelete: (commentId: Id<"comments">) => void;
	onAddReaction: (commentId: Id<"comments">, emoji: string) => void;
}

function CommentItem({
	comment,
	allComments,
	depth = 0,
	currentUser,
	users,
	onReply,
	onEdit,
	onDelete,
	onAddReaction,
}: CommentItemProps) {
	const [isReplying, setIsReplying] = useState(false);
	const [isEditing, setIsEditing] = useState(false);

	const replyForm = useDebouncedForm({
		initialValue: "",
		onChange: () => {},
		debounceMs: 250,
		immediateOnCommit: false,
	});

	const editForm = useDebouncedForm({
		initialValue: comment.content,
		onChange: () => {},
		debounceMs: 250,
		immediateOnCommit: false,
	});

	const isOwnComment = currentUser
		? comment.author.id === currentUser.id
		: false;

	const replies = useMemo(
		() => allComments.filter((c) => c.parentCommentId === comment.id),
		[allComments, comment.id],
	);
	const hasReplies = replies.length > 0;

	const handleSubmitReply = () => {
		if (replyForm.value.trim()) {
			const commentId = parseCommentId(comment.id);
			if (!commentId) return;
			onReply(commentId, replyForm.value.trim());
			replyForm.reset();
			setIsReplying(false);
		}
	};

	const handleSubmitEdit = () => {
		if (editForm.value.trim() && editForm.value !== comment.content) {
			const commentId = parseCommentId(comment.id);
			if (!commentId) return;
			onEdit(commentId, editForm.value.trim());
		}
		setIsEditing(false);
	};

	const handleCancelEdit = () => {
		editForm.reset();
		setIsEditing(false);
	};

	const handleStartEdit = () => {
		editForm.reset();
		setIsEditing(true);
	};

	return (
		<div
			className={`${depth > 0 ? "mt-3 ml-4 border-l-2 border-border pl-3 sm:ml-8 sm:pl-4" : "mt-4"}`}
		>
			<div className="flex gap-2.5 sm:gap-3">
				<Avatar className="size-8 shrink-0">
					<AvatarImage src={comment.author.avatarUrl || undefined} />
					<AvatarFallback className="text-xs">
						{getInitials(comment.author.name)}
					</AvatarFallback>
				</Avatar>

				<div className="flex-1 min-w-0">
					<div className="mb-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
						<span className="font-medium text-sm">{comment.author.name}</span>
						<span className="text-xs text-muted-foreground">
							{formatDate(comment.createdAt)}
							{comment.contentUpdatedAt != null && " (edited)"}
						</span>
					</div>

					{isEditing ? (
						<div className="space-y-2">
							<MentionTextarea
								value={editForm.value}
								onChange={editForm.setValue}
								className="min-h-[80px] text-sm"
								users={users}
								currentUserId={currentUser?.id}
							/>
							<div className="flex gap-2">
								<Button size="sm" onClick={handleSubmitEdit}>
									Save
								</Button>
								<Button size="sm" variant="ghost" onClick={handleCancelEdit}>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<>
							<div className="prose prose-sm dark:prose-invert max-w-none text-sm">
								<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
									{comment.content}
								</ReactMarkdown>
							</div>

							<ReactionDisplay
								reactions={comment.reactions}
								onAddReaction={(emoji) => {
									const commentId = parseCommentId(comment.id);
									if (!commentId) return;
									onAddReaction(commentId, emoji);
								}}
							/>

							<div className="mt-2 flex flex-wrap items-center gap-1.5">
								<ReactionButton
									onAddReaction={(emoji) => {
										const commentId = parseCommentId(comment.id);
										if (!commentId) return;
										onAddReaction(commentId, emoji);
									}}
								/>

								<Button
									variant="ghost"
									size="sm"
									className="h-7 px-2 text-xs gap-1"
									onClick={() => setIsReplying(!isReplying)}
								>
									<Reply className="size-3.5" />
									Reply
								</Button>

								{isOwnComment && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="sm" className="px-2">
												<MoreHorizontal className="size-3.5" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="start">
											<DropdownMenuItem onClick={handleStartEdit}>
												<Edit2 className="size-3.5 mr-2" />
												Edit
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => {
													const commentId = parseCommentId(comment.id);
													if (!commentId) return;
													onDelete(commentId);
												}}
												className="text-destructive"
											>
												<Trash2 className="size-3.5 mr-2" />
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>

							{isReplying && (
								<div className="mt-3 space-y-2">
									<MentionTextarea
										placeholder="Write a reply..."
										value={replyForm.value}
										onChange={replyForm.setValue}
										className="min-h-[80px] text-sm"
										users={users}
										currentUserId={currentUser?.id}
									/>
									<div className="flex flex-wrap gap-2">
										<Button size="sm" onClick={handleSubmitReply}>
											<CornerDownRight className="size-3.5 mr-1" />
											Reply
										</Button>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => {
												setIsReplying(false);
												replyForm.reset();
											}}
										>
											Cancel
										</Button>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</div>

			{hasReplies && (
				<div className="mt-2">
					{replies.map((reply) => (
						<CommentItem
							key={reply.id}
							comment={reply}
							allComments={allComments}
							depth={depth + 1}
							currentUser={currentUser}
							users={users}
							onReply={onReply}
							onEdit={onEdit}
							onDelete={onDelete}
							onAddReaction={onAddReaction}
						/>
					))}
				</div>
			)}
		</div>
	);
}

interface CommentsSectionProps {
	taskId: Id<"tasks"> | Id<"competitionUpdates">;
	className?: string;
}

export function CommentsSection({ taskId, className }: CommentsSectionProps) {
	const { users } = useUsers();
	const authUserResult = useQuery(api.core.users.getCurrentUser);
	const { data: authUser } = useRetainedQueryResult(authUserResult);
	const { comments: allComments } = useCommentsForTask(taskId);
	const comments = useMemo(
		() =>
			allComments.filter(
				(c) =>
					c.parentType === "task" &&
					c.parentId === taskId &&
					c.parentCommentId === null,
			),
		[allComments, taskId],
	);
	const { addComment, editComment, deleteComment, addReaction } =
		useCommentMutations();

	const currentUser: User | undefined = useMemo(() => {
		if (!authUser) {
			return undefined;
		}
		return users.find((user) => user.id === authUser._id);
	}, [users, authUser]);

	const newCommentForm = useDebouncedForm({
		initialValue: "",
		onChange: () => {},
		debounceMs: 250,
		immediateOnCommit: false,
	});

	const handleSubmitComment = () => {
		if (newCommentForm.value.trim() && currentUser) {
			void addComment(
				"task",
				taskId,
				newCommentForm.value.trim(),
				null,
				currentUser,
			).catch(onMutationError);
			newCommentForm.reset();
		}
	};

	const handleReply = (parentCommentId: Id<"comments">, content: string) => {
		if (currentUser) {
			void addComment(
				"task",
				taskId,
				content,
				parentCommentId,
				currentUser,
			).catch(onMutationError);
		}
	};

	const handleEdit = (commentId: Id<"comments">, content: string) => {
		void editComment(commentId, content).catch(onMutationError);
	};

	const handleDelete = (commentId: Id<"comments">) => {
		void deleteComment(commentId).catch(onMutationError);
	};

	const handleAddReaction = (commentId: Id<"comments">, emoji: string) => {
		void addReaction(commentId, emoji).catch(onMutationError);
	};

	return (
		<div className={cn("mt-8", className)}>
			<div className="mb-4 flex items-center gap-2">
				<MessageCircle className="size-4 text-muted-foreground" />
				<h3 className="text-sm font-medium">Comments</h3>
				<span className="text-xs text-muted-foreground">
					({comments.length})
				</span>
			</div>

			<div className="mb-6 flex gap-2.5 sm:gap-3">
				<Avatar className="size-8 shrink-0">
					<AvatarImage src={currentUser?.avatarUrl || undefined} />
					<AvatarFallback className="text-xs">
						{currentUser ? getInitials(currentUser.name) : "?"}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 space-y-2">
					<MentionTextarea
						placeholder="Leave a comment..."
						value={newCommentForm.value}
						onChange={newCommentForm.setValue}
						className="min-h-[100px] text-sm"
						users={users}
						currentUserId={currentUser?.id}
					/>
					<div className="flex items-center justify-end">
						<Button
							size="sm"
							onClick={handleSubmitComment}
							disabled={!newCommentForm.value.trim() || !currentUser}
						>
							Comment
						</Button>
					</div>
				</div>
			</div>

			<div className="space-y-4">
				{comments.length === 0 ? (
					<p className="text-sm text-muted-foreground text-center py-8">
						No comments yet. Be the first to comment!
					</p>
				) : (
					comments.map((comment) => (
						<CommentItem
							key={comment.id}
							comment={comment}
							allComments={allComments}
							currentUser={currentUser}
							users={users}
							onReply={handleReply}
							onEdit={handleEdit}
							onDelete={handleDelete}
							onAddReaction={handleAddReaction}
						/>
					))
				)}
			</div>
		</div>
	);
}
