import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDataV2 } from "@/data/data-store-v2";
import type { Comment, User } from "@/data/types-new";
import { formatDate, getInitials } from "@/lib/format-utils";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CommentItemProps {
	comment: Comment;
	allComments: Comment[];
	depth?: number;
	currentUser: User;
	onReply: (parentCommentId: string, content: string) => void;
	onEdit: (commentId: string, content: string) => void;
	onDelete: (commentId: string) => void;
	onAddReaction: (commentId: string, emoji: string) => void;
}

function CommentItem({
	comment,
	allComments,
	depth = 0,
	currentUser,
	onReply,
	onEdit,
	onDelete,
	onAddReaction,
}: CommentItemProps) {
	const [isReplying, setIsReplying] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [replyContent, setReplyContent] = useState("");
	const [editContent, setEditContent] = useState(comment.content);

	const isOwnComment = comment.author.id === currentUser.id;

	// Derive replies from flat array using parentCommentId
	const replies = useMemo(
		() => allComments.filter((c) => c.parentCommentId === comment.id),
		[allComments, comment.id],
	);
	const hasReplies = replies.length > 0;

	const handleSubmitReply = () => {
		if (replyContent.trim()) {
			onReply(comment.id, replyContent.trim());
			setReplyContent("");
			setIsReplying(false);
		}
	};

	const handleSubmitEdit = () => {
		if (editContent.trim() && editContent !== comment.content) {
			onEdit(comment.id, editContent.trim());
		}
		setIsEditing(false);
	};

	return (
		<div
			className={`${depth > 0 ? "ml-8 mt-3 border-l-2 border-border pl-4" : "mt-4"}`}
		>
			<div className="flex gap-3">
				<Avatar className="size-8 shrink-0">
					<AvatarImage src={comment.author.avatarUrl} />
					<AvatarFallback className="text-xs">
						{getInitials(comment.author.name)}
					</AvatarFallback>
				</Avatar>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="font-medium text-sm">{comment.author.name}</span>
						<span className="text-xs text-muted-foreground">
							{formatDate(comment.createdAt)}
							{comment.updatedAt !== comment.createdAt && " (edited)"}
						</span>
					</div>

					{isEditing ? (
						<div className="space-y-2">
							<Textarea
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								className="min-h-[80px] text-sm"
								autoFocus
							/>
							<div className="flex gap-2">
								<Button size="sm" onClick={handleSubmitEdit}>
									Save
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										setIsEditing(false);
										setEditContent(comment.content);
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<>
							<div className="prose prose-sm dark:prose-invert max-w-none text-sm">
								<ReactMarkdown>{comment.content}</ReactMarkdown>
							</div>

							{/* Reactions */}
							<ReactionDisplay
								reactions={comment.reactions}
								onAddReaction={(emoji) => onAddReaction(comment.id, emoji)}
							/>

							{/* Actions */}
							<div className="flex items-center gap-1 mt-2">
								<ReactionButton
									onAddReaction={(emoji) => onAddReaction(comment.id, emoji)}
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
											<Button variant="ghost" size="sm" className="h-7 px-2">
												<MoreHorizontal className="size-3.5" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="start">
											<DropdownMenuItem onClick={() => setIsEditing(true)}>
												<Edit2 className="size-3.5 mr-2" />
												Edit
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => onDelete(comment.id)}
												className="text-destructive"
											>
												<Trash2 className="size-3.5 mr-2" />
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>

							{/* Reply Input */}
							{isReplying && (
								<div className="mt-3 space-y-2">
									<Textarea
										placeholder="Write a reply..."
										value={replyContent}
										onChange={(e) => setReplyContent(e.target.value)}
										className="min-h-[80px] text-sm"
										autoFocus
									/>
									<div className="flex gap-2">
										<Button size="sm" onClick={handleSubmitReply}>
											<CornerDownRight className="size-3.5 mr-1" />
											Reply
										</Button>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => {
												setIsReplying(false);
												setReplyContent("");
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

			{/* Nested Replies */}
			{hasReplies && (
				<div className="mt-2">
					{replies.map((reply) => (
						<CommentItem
							key={reply.id}
							comment={reply}
							allComments={allComments}
							depth={depth + 1}
							currentUser={currentUser}
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
	taskId: string;
}

export function CommentsSection({ taskId }: CommentsSectionProps) {
	const [newComment, setNewComment] = useState("");

	const users = useDataV2((state) => state.users);
	const allComments = useDataV2((state) => state.comments);
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
	const addComment = useDataV2((state) => state.addComment);
	const editComment = useDataV2((state) => state.editComment);
	const deleteComment = useDataV2((state) => state.deleteComment);
	const addReaction = useDataV2((state) => state.addReaction);

	// Get current user (first user for demo)
	const currentUser = users[0];

	const handleSubmitComment = () => {
		if (newComment.trim() && currentUser) {
			addComment("task", taskId, newComment.trim(), undefined, currentUser);
			setNewComment("");
		}
	};

	const handleReply = (parentCommentId: string, content: string) => {
		if (currentUser) {
			addComment("task", taskId, content, parentCommentId, currentUser);
		}
	};

	return (
		<div className="mt-8">
			<div className="flex items-center gap-2 mb-4">
				<MessageCircle className="size-4 text-muted-foreground" />
				<h3 className="text-sm font-medium">Comments</h3>
				<span className="text-xs text-muted-foreground">
					({comments.length})
				</span>
			</div>

			{/* New Comment Input */}
			<div className="flex gap-3 mb-6">
				<Avatar className="size-8 shrink-0">
					<AvatarImage src={currentUser?.avatarUrl} />
					<AvatarFallback className="text-xs">
						{currentUser ? getInitials(currentUser.name) : "?"}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 space-y-2">
					<Textarea
						placeholder="Leave a comment..."
						value={newComment}
						onChange={(e) => setNewComment(e.target.value)}
						className="min-h-[100px] text-sm"
					/>
					<div className="flex justify-between items-center">
						<span className="text-xs text-muted-foreground" />
						<Button
							size="sm"
							onClick={handleSubmitComment}
							disabled={!newComment.trim() || !currentUser}
						>
							Comment
						</Button>
					</div>
				</div>
			</div>

			{/* Comments List */}
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
							onReply={handleReply}
							onEdit={editComment}
							onDelete={deleteComment}
							onAddReaction={addReaction}
						/>
					))
				)}
			</div>
		</div>
	);
}
