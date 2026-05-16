import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Competition } from "@/data/types-new";

export function CompetitionEditDetailsModal({
	competition,
	open,
	onOpenChange,
	onSave,
}: {
	competition: Competition;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (payload: { name: string; description: string }) => void;
}) {
	const [nameDraft, setNameDraft] = useState(competition.name);
	const [descriptionDraft, setDescriptionDraft] = useState(
		competition.description ?? "",
	);

	useEffect(() => {
		if (open) return;
		setNameDraft(competition.name);
		setDescriptionDraft(competition.description ?? "");
	}, [competition.description, competition.name, open]);

	return (
		<ResponsiveModal
			open={open}
			onOpenChange={onOpenChange}
			dialogContentClassName="max-w-2xl p-0"
			sheetContentClassName="p-0"
		>
			<div className="border-b border-border/70 px-5 py-4">
				<div className="text-lg font-semibold tracking-tight">
					Edit competition
				</div>
				<div className="mt-1 text-sm text-muted-foreground">
					Update the public-facing identity for this competition.
				</div>
			</div>
			<div className="space-y-4 px-5 py-4">
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="competition-name">
						Name
					</label>
					<Input
						id="competition-name"
						value={nameDraft}
						onChange={(e) => setNameDraft(e.target.value)}
						placeholder="Competition name"
						autoFocus
					/>
				</div>
				<div className="space-y-2">
					<label
						className="text-sm font-medium"
						htmlFor="competition-description"
					>
						Description
					</label>
					<Textarea
						id="competition-description"
						value={descriptionDraft}
						onChange={(e) => setDescriptionDraft(e.target.value)}
						placeholder="Write a short description..."
						className="min-h-28 resize-none"
					/>
				</div>
			</div>
			<div className="flex flex-col-reverse gap-2 border-t border-border/70 px-5 py-4 sm:flex-row sm:justify-end">
				<Button variant="outline" onClick={() => onOpenChange(false)}>
					Cancel
				</Button>
				<Button
					onClick={() =>
						onSave({
							name: nameDraft,
							description: descriptionDraft,
						})
					}
				>
					Save changes
				</Button>
			</div>
		</ResponsiveModal>
	);
}
