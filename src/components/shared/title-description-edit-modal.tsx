import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
	FormModalFooter,
	FormModalHeader,
} from "@/components/shared/form-modal-layout";

type FocusField = "title" | "description";

interface TitleDescriptionEditModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entityLabel: string;
	initialTitle: string;
	initialDescription: string;
	initialFocusField?: FocusField;
	onSave: (values: { title: string; description: string }) => Promise<void>;
}

export function TitleDescriptionEditModal({
	open,
	onOpenChange,
	entityLabel,
	initialTitle,
	initialDescription,
	initialFocusField = "title",
	onSave,
}: TitleDescriptionEditModalProps) {
	const [title, setTitle] = useState(initialTitle);
	const [description, setDescription] = useState(initialDescription);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		setTitle(initialTitle);
		setDescription(initialDescription);
	}, [open, initialTitle, initialDescription]);

	const trimmedTitle = title.trim();
	const hasChanges = useMemo(
		() => trimmedTitle !== initialTitle || description !== initialDescription,
		[trimmedTitle, initialTitle, description, initialDescription],
	);

	const handleClose = () => {
		if (isSaving) return;
		onOpenChange(false);
	};

	const handleSubmit = async () => {
		if (!trimmedTitle || !hasChanges || isSaving) return;
		setIsSaving(true);
		try {
			await onSave({
				title: trimmedTitle,
				description,
			});
			onOpenChange(false);
		} catch {
			// Parent handlers are expected to surface the error.
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) handleClose();
			}}
		>
			<DialogContent className="sm:max-w-2xl">
				<FormModalHeader title={`Edit ${entityLabel}`} />

				<div className="space-y-4 px-6">
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="entity-title">
							Title
						</label>
						<Input
							id="entity-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder={`${entityLabel} title`}
							autoFocus={initialFocusField === "title"}
						/>
					</div>

					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="entity-description">
							Description
						</label>
						<Textarea
							id="entity-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder={`Add a ${entityLabel.toLowerCase()} description...`}
							className="min-h-40 resize-none"
							autoFocus={initialFocusField === "description"}
						/>
					</div>

					<FormModalFooter
						mode="edit"
						onCancel={handleClose}
						onSubmit={() => {
							void handleSubmit();
						}}
						submitDisabled={!trimmedTitle || !hasChanges}
						createLabel="Create"
						saveLabel="Save changes"
						isSubmitting={isSaving}
						submittingLabel="Saving..."
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
