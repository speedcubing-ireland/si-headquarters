import { useState } from "react";
import { toast } from "sonner";
import { CompetitionEditDetailsModal } from "@/components/competitions/competition-edit-details-modal";
import type { CompetitionTaskSummary } from "@/components/competitions/competition-detail-utils";
import { CompetitionInfoPanel } from "@/components/competitions/competition-info-panel";
import { CompetitionOverviewPanel } from "@/components/competitions/competition-overview-panel";
import { CompetitionResourceLinksPanel } from "@/components/competitions/competition-resource-links-panel";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import type { Competition } from "@/data/types-new";

interface CompetitionDetailsProps {
	competition: Competition;
	isEditable?: boolean;
	isSubscribed?: boolean;
	onToggleSubscription?: () => void;
	taskSummary: CompetitionTaskSummary;
	onUpdate?: (updates: Partial<Competition>) => void;
	onDelete?: () => void;
}

export function CompetitionDetails({
	competition,
	isEditable = false,
	isSubscribed = false,
	onToggleSubscription,
	taskSummary,
	onUpdate,
	onDelete,
}: CompetitionDetailsProps) {
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	const canEdit = isEditable && typeof onUpdate === "function";
	const canDelete = isEditable && typeof onDelete === "function";

	const handleSaveDetails = ({
		name,
		description,
	}: {
		name: string;
		description: string;
	}) => {
		if (!canEdit) return;
		const trimmedName = name.trim();
		if (!trimmedName) {
			toast.error("Competition name is required");
			return;
		}
		onUpdate({
			name: trimmedName,
			description: description.trim() || "",
		});
		setEditModalOpen(false);
	};

	return (
		<section className="space-y-5 sm:space-y-6">
			<CompetitionOverviewPanel
				competition={competition}
				canEdit={canEdit}
				canDelete={canDelete}
				isSubscribed={isSubscribed}
				onToggleSubscription={onToggleSubscription}
				taskSummary={taskSummary}
				onEditDetails={() => setEditModalOpen(true)}
				onDelete={() => setDeleteDialogOpen(true)}
			/>

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
				<CompetitionInfoPanel competition={competition} canEdit={canEdit} />
				<CompetitionResourceLinksPanel
					competition={competition}
					canEdit={canEdit}
				/>
			</div>

			<CompetitionEditDetailsModal
				competition={competition}
				open={editModalOpen}
				onOpenChange={setEditModalOpen}
				onSave={handleSaveDetails}
			/>

			<ConfirmDeleteDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				title="Delete competition?"
				description={`This will permanently delete "${competition.name}" and cannot be undone.`}
				onConfirm={() => {
					void onDelete?.();
				}}
			/>
		</section>
	);
}
