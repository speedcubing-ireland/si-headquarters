import { Smile } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { CommentReaction } from "@/data/types-new";

const COMMON_EMOJIS = ["👍", "👎", "😄", "🎉", "❤️", "🚀", "👀", "🤔"];

interface ReactionButtonProps {
	onAddReaction: (emoji: string) => void;
	label?: string;
}

export function ReactionButton({
	onAddReaction,
	label = "React",
}: ReactionButtonProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
					<Smile className="size-3.5" />
					{label}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-2">
				<div className="flex gap-1">
					{COMMON_EMOJIS.map((emoji) => (
						<button
							key={emoji}
							type="button"
							onClick={() => onAddReaction(emoji)}
							className="text-lg hover:bg-muted rounded p-1 transition-colors"
						>
							{emoji}
						</button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

interface ReactionDisplayProps {
	reactions: CommentReaction[];
	onAddReaction: (emoji: string) => void;
}

export function ReactionDisplay({
	reactions,
	onAddReaction,
}: ReactionDisplayProps) {
	if (reactions.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-1 mt-2">
			{reactions.map((reaction) => (
				<button
					key={reaction.emoji}
					type="button"
					onClick={() => onAddReaction(reaction.emoji)}
					title={reaction.users.map((u) => u.name).join(", ")}
				>
					<Badge
						variant="secondary"
						className="hover:bg-secondary/80 transition-colors"
					>
						<span>{reaction.emoji}</span>
						<span>{reaction.users.length}</span>
					</Badge>
				</button>
			))}
		</div>
	);
}
