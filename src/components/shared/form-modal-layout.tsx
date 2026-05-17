import React from "react";
import { Loader2 } from "lucide-react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const FormModalHeader = React.memo(function FormModalHeader({
	title,
}: {
	title: string;
}) {
	return (
		<DialogHeader className="px-6 pt-6 pb-4 border-b">
			<DialogTitle>{title}</DialogTitle>
		</DialogHeader>
	);
});

export const FormModalFooter = React.memo(function FormModalFooter({
	mode,
	onCancel,
	onSubmit,
	submitDisabled,
	createLabel,
	saveLabel,
	isSubmitting = false,
	submittingLabel = "Saving...",
}: {
	mode: "create" | "edit";
	onCancel: () => void;
	onSubmit: () => void;
	submitDisabled: boolean;
	createLabel: string;
	saveLabel: string;
	isSubmitting?: boolean;
	submittingLabel?: string;
}) {
	return (
		<div className="px-6 py-4 border-t flex justify-end gap-2">
			<Button
				type="button"
				variant="outline"
				onClick={onCancel}
				disabled={isSubmitting}
			>
				Cancel
			</Button>
			<Button
				type="submit"
				onClick={onSubmit}
				disabled={submitDisabled || isSubmitting}
			>
				{isSubmitting ? (
					<>
						<Loader2 className="size-4 animate-spin mr-2" />
						{submittingLabel}
					</>
				) : mode === "create" ? (
					createLabel
				) : (
					saveLabel
				)}
			</Button>
		</div>
	);
});
