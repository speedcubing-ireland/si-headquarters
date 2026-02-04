"use client";

import { glass } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { CalendarDays, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
	EditableCompLeadCell,
	EditableLeadDelegateCell,
	EditableOrganisersCell,
	EditablePhaseCell,
} from "@/components/competitions/editable-phase-and-roles";
import { LeadsDisplay } from "@/components/competitions/leads-display";
import { EditableText } from "@/components/shared/editable-text";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { Competition } from "@/data/types-new";
import { formatDate } from "@/lib/format-utils";

const COMPETITION_AVATAR_SIZE = 48;

interface CompetitionDetailsProps {
	competition: Competition;
	isEditable?: boolean;
	onUpdate?: (updates: Partial<Competition>) => void;
	onDelete?: () => void;
}

export function CompetitionDetails({
	competition,
	isEditable = false,
	onUpdate,
	onDelete,
}: CompetitionDetailsProps) {
	const currentPhase = competition.phases[competition.currentPhaseIdx];

	const [isEditingDates, setIsEditingDates] = useState(false);
	const [startDraft, setStartDraft] = useState(competition.compStart);
	const [endDraft, setEndDraft] = useState(competition.compEnd);

	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [descriptionDraft, setDescriptionDraft] = useState(
		competition.description ?? "",
	);

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	const canEdit = isEditable && typeof onUpdate === "function";
	const canDelete = isEditable && typeof onDelete === "function";

	const handleCommitDates = () => {
		if (!canEdit) {
			setIsEditingDates(false);
			setStartDraft(competition.compStart);
			setEndDraft(competition.compEnd);
			return;
		}
		if (
			startDraft &&
			endDraft &&
			(startDraft !== competition.compStart || endDraft !== competition.compEnd)
		) {
			onUpdate({ compStart: startDraft, compEnd: endDraft });
		}
		setIsEditingDates(false);
	};

	const handleCommitDescription = () => {
		if (!canEdit) {
			setIsEditingDescription(false);
			setDescriptionDraft(competition.description ?? "");
			return;
		}
		if (descriptionDraft !== (competition.description ?? "")) {
			onUpdate({ description: descriptionDraft });
		}
		setIsEditingDescription(false);
	};

	const avatarDataUri = useMemo(
		() =>
			createAvatar(glass, {
				seed: competition.name,
				size: COMPETITION_AVATAR_SIZE,
			}).toDataUri(),
		[competition.name],
	);

	return (
		<section className="space-y-6">
			<div className="flex items-start gap-4">
				<img
					src={avatarDataUri}
					alt=""
					className="size-12 shrink-0 rounded-lg border border-border object-cover"
				/>

				<div className="flex-1 space-y-2">
					{canEdit ? (
						<EditableText
							value={competition.name}
							onSubmit={(next) => onUpdate({ name: next })}
							className="border-0 px-0 text-2xl font-semibold tracking-tight focus-visible:ring-0"
							displayClassName="text-left text-2xl font-semibold tracking-tight text-balance hover:bg-muted/60 -mx-1 rounded px-1"
						/>
					) : (
						<h1 className="text-2xl font-semibold tracking-tight text-balance">
							{competition.name}
						</h1>
					)}

					<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
						{canEdit && isEditingDates ? (
							<div className="flex flex-wrap items-center gap-2">
								<input
									type="date"
									value={startDraft}
									onChange={(e) => setStartDraft(e.target.value)}
									className="h-7 rounded border border-border bg-background px-2 text-xs"
								/>
								<span>–</span>
								<input
									type="date"
									value={endDraft}
									onChange={(e) => setEndDraft(e.target.value)}
									className="h-7 rounded border border-border bg-background px-2 text-xs"
								/>
								<button
									type="button"
									onClick={handleCommitDates}
									className="text-xs font-medium text-foreground"
								>
									Save
								</button>
								<button
									type="button"
									onClick={() => {
										setIsEditingDates(false);
										setStartDraft(competition.compStart);
										setEndDraft(competition.compEnd);
									}}
									className="text-xs text-muted-foreground"
								>
									Cancel
								</button>
							</div>
						) : (
							<button
								type="button"
								className={
									canEdit
										? "inline-flex items-center gap-1 rounded px-1 hover:bg-muted/60"
										: "inline-flex items-center gap-1"
								}
								onClick={() => {
									if (!canEdit) return;
									setIsEditingDates(true);
								}}
							>
								<CalendarDays className="size-3" />
								<span>{formatDate(competition.compStart)}</span>
								<span>–</span>
								<span>{formatDate(competition.compEnd)}</span>
							</button>
						)}

						{currentPhase && (
							<>
								<Separator
									orientation="vertical"
									className="h-3 shrink-0 bg-border"
								/>
								<Badge
									variant="outline"
									className="gap-1 border-border bg-background text-[11px] font-normal"
								>
									<span className="size-1.5 rounded-full bg-chart-1" />
									{currentPhase.name}
								</Badge>
							</>
						)}
					</div>
				</div>
			</div>

			{canEdit && (
				<div className="space-y-1">
					<div className="text-xs text-muted-foreground">Description</div>
					{isEditingDescription ? (
						<Input
							value={descriptionDraft}
							onChange={(e) => setDescriptionDraft(e.target.value)}
							onBlur={handleCommitDescription}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCommitDescription();
								if (e.key === "Escape") {
									setDescriptionDraft(competition.description ?? "");
									setIsEditingDescription(false);
								}
							}}
							className="border-0 px-0 text-sm focus-visible:ring-0"
							placeholder="Add a short description..."
							autoFocus
						/>
					) : (
						<button
							type="button"
							className="w-full text-left text-sm text-muted-foreground hover:bg-muted/60 -mx-1 rounded px-1"
							onClick={() => setIsEditingDescription(true)}
						>
							{competition.description || "Click to add a description..."}
						</button>
					)}
				</div>
			)}

			<div className="grid grid-cols-1 gap-6 pt-2 text-sm md:grid-cols-2">
				<div className="space-y-3">
					<div>
						<div className="mb-1 text-xs text-muted-foreground">
							Competition lead
						</div>
						{canEdit ? (
							<EditableCompLeadCell competition={competition} />
						) : (
							<LeadsDisplay
								leads={competition.compLead ? [competition.compLead] : []}
								variant="detailed"
							/>
						)}
					</div>
					<div>
						<div className="mb-1 text-xs text-muted-foreground">
							Lead delegate
						</div>
						{canEdit ? (
							<EditableLeadDelegateCell competition={competition} />
						) : (
							<LeadsDisplay
								leads={
									competition.leadDelegate ? [competition.leadDelegate] : []
								}
								variant="detailed"
							/>
						)}
					</div>
					<div>
						<div className="mb-1 text-xs text-muted-foreground">Organisers</div>
						{canEdit ? (
							<EditableOrganisersCell competition={competition} />
						) : (
							<LeadsDisplay leads={competition.organisers} variant="detailed" />
						)}
					</div>
				</div>

				<div className="space-y-3">
					<div>
						<div className="mb-1 text-xs text-muted-foreground">
							Core details
						</div>
						<div className="flex flex-wrap items-center gap-2 text-xs">
							{canEdit && <EditablePhaseCell competition={competition} />}
							<Badge
								variant="outline"
								className="gap-1 border-border bg-background font-normal"
							>
								<Users className="size-3" />
								{competition.organisers.length} organiser
								{competition.organisers.length === 1 ? "" : "s"}
							</Badge>
							{competition.progressUpdates.length > 0 && (
								<Badge
									variant="outline"
									className="gap-1 border-border bg-background font-normal"
								>
									<span className="size-1.5 rounded-full bg-success" />
									{competition.progressUpdates.length} update
									{competition.progressUpdates.length === 1 ? "" : "s"}
								</Badge>
							)}
						</div>
					</div>

					<div className="space-y-1">
						<div className="text-xs text-muted-foreground">Created</div>
						<div>{formatDate(competition.createdAt)}</div>
					</div>
					<div className="space-y-1">
						<div className="text-xs text-muted-foreground">Updated</div>
						<div>{formatDate(competition.updatedAt)}</div>
					</div>
				</div>
			</div>

			{canDelete && (
				<div className="pt-6 border-t">
					<Button
						variant="destructive"
						size="sm"
						onClick={() => setDeleteDialogOpen(true)}
						className="gap-2"
					>
						<Trash2 className="size-4" />
						Delete Competition
					</Button>
					<AlertDialog
						open={deleteDialogOpen}
						onOpenChange={setDeleteDialogOpen}
					>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete Competition?</AlertDialogTitle>
								<AlertDialogDescription>
									Are you sure you want to permanently delete "
									{competition.name}"? This will delete all tasks, subtasks,
									comments, reactions, updates, and other associated data. This
									action cannot be undone.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									variant="destructive"
									onClick={() => {
										setDeleteDialogOpen(false);
										onDelete?.();
									}}
								>
									Delete Permanently
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			)}
		</section>
	);
}
