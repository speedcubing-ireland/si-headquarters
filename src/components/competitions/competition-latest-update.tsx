"use client";

import { CheckCircle2, Edit3 } from "lucide-react";
import { useState } from "react";

import {
	ReactionButton,
	ReactionDisplay,
} from "@/components/shared/reaction-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCompetition, useUsers } from "@/hooks/use-convex-data";
import type { Competition, ProgressUpdate } from "@/data/types-new";
import { formatDateShort } from "@/lib/format-utils";

const statusConfig = {
	"on-track": {
		label: "On track",
		className: "text-success",
		icon: CheckCircle2,
	},
	"at-risk": {
		label: "At risk",
		className: "text-warning",
		icon: CheckCircle2,
	},
	"off-track": {
		label: "Off track",
		className: "text-destructive",
		icon: CheckCircle2,
	},
} as const;

interface CompetitionLatestUpdateProps {
	competition: Competition;
}

export function CompetitionLatestUpdate({
	competition,
}: CompetitionLatestUpdateProps) {
	const { users } = useUsers();
	const freshCompetition = useCompetition(competition.id) ?? competition;

	const currentUser = users[0];

	// Stub: Phase 3 will add progress update reactions in Convex
	const addUpdateReaction = (
		_competitionId: string,
		_updateId: string,
		_emoji: string,
		_actor: { id: string; name: string; avatarUrl: string },
	) => {};

	const [isCreating, setIsCreating] = useState(false);
	const [message, setMessage] = useState("");
	const [status, setStatus] = useState<ProgressUpdate["status"]>("on-track");

	// Phase 2: progressUpdates live in Convex as []; Phase 3 will add progress update mutations
	const latest = [...(freshCompetition.progressUpdates ?? [])].sort((a, b) =>
		b.timestamp.localeCompare(a.timestamp),
	)[0];

	const handleCreate = () => {
		if (!message.trim()) return;
		// Stub: progress updates not yet in Convex (Phase 3)
		setIsCreating(false);
		setMessage("");
		setStatus("on-track");
	};

	if (!latest && !isCreating) {
		return (
			<Card className="border-border shadow-none">
				<CardHeader className="flex flex-row items-center justify-between pb-3">
					<span className="text-sm font-medium text-muted-foreground">
						Latest update
					</span>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
						onClick={() => setIsCreating(true)}
					>
						<Edit3 className="size-3" />
						New update
					</Button>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No updates yet. Add the first update for this competition.
					</p>
				</CardContent>
			</Card>
		);
	}

	const active = isCreating ? undefined : latest;
	const statusInfo = active
		? statusConfig[active.status]
		: statusConfig[status];
	const StatusIcon = statusInfo.icon;

	return (
		<Card className="border-border shadow-none">
			<CardHeader className="flex flex-row items-center justify-between pb-3">
				<span className="text-sm font-medium text-muted-foreground">
					Latest update
				</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
					onClick={() => setIsCreating(true)}
				>
					<Edit3 className="size-3" />
					New update
				</Button>
			</CardHeader>
			<CardContent className="space-y-4">
				{active && (
					<>
						<div className="flex items-center gap-2">
							<StatusIcon className={`size-4 ${statusInfo.className}`} />
							<span className={`text-sm font-medium ${statusInfo.className}`}>
								{statusInfo.label}
							</span>
							<UserAvatar
								user={active.postedBy}
								size="sm"
								showName
								nameClassName="text-sm text-foreground"
							/>
							<span className="text-sm text-muted-foreground">
								{formatDateShort(active.timestamp)}
							</span>
						</div>

						{active.message && (
							<p className="text-sm leading-relaxed text-muted-foreground">
								{active.message}
							</p>
						)}

						{/* Reactions */}
						<div className="flex items-center gap-2 pt-2">
							<ReactionDisplay
								reactions={active.reactions}
								onAddReaction={(emoji) =>
									addUpdateReaction(
										competition.id,
										active.id,
										emoji,
										currentUser,
									)
								}
							/>
							<ReactionButton
								onAddReaction={(emoji) =>
									addUpdateReaction(
										competition.id,
										active.id,
										emoji,
										currentUser,
									)
								}
							/>
						</div>
					</>
				)}

				{isCreating && (
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-xs">
							<button
								type="button"
								className={
									status === "on-track"
										? "rounded bg-muted px-2 py-1 font-medium"
										: "rounded px-2 py-1 text-muted-foreground hover:bg-muted"
								}
								onClick={() => setStatus("on-track")}
							>
								On track
							</button>
							<button
								type="button"
								className={
									status === "at-risk"
										? "rounded bg-muted px-2 py-1 font-medium"
										: "rounded px-2 py-1 text-muted-foreground hover:bg-muted"
								}
								onClick={() => setStatus("at-risk")}
							>
								At risk
							</button>
							<button
								type="button"
								className={
									status === "off-track"
										? "rounded bg-muted px-2 py-1 font-medium"
										: "rounded px-2 py-1 text-muted-foreground hover:bg-muted"
								}
								onClick={() => setStatus("off-track")}
							>
								Off track
							</button>
						</div>
						<textarea
							className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
							placeholder="Share a quick update..."
							value={message}
							onChange={(e) => setMessage(e.target.value)}
						/>
						<div className="flex justify-end gap-2">
							<Button
								variant="ghost"
								size="sm"
								className="h-7"
								onClick={() => {
									setIsCreating(false);
									setMessage("");
									setStatus("on-track");
								}}
							>
								Cancel
							</Button>
							<Button size="sm" className="h-7" onClick={handleCreate}>
								Save update
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
