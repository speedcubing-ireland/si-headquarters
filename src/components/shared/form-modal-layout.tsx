import React from "react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Shared header for create/edit form modals (task, competition, etc.).
 * Use inside DialogContent with p-0.
 */
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

/**
 * Shared footer for create/edit form modals: Cancel + primary submit button.
 */
export const FormModalFooter = React.memo(function FormModalFooter({
	mode,
	onCancel,
	onSubmit,
	submitDisabled,
	createLabel,
	saveLabel,
}: {
	mode: "create" | "edit";
	onCancel: () => void;
	onSubmit: () => void;
	submitDisabled: boolean;
	createLabel: string;
	saveLabel: string;
}) {
	return (
		<div className="px-6 py-4 border-t flex justify-end gap-2">
			<Button variant="outline" onClick={onCancel}>
				Cancel
			</Button>
			<Button onClick={onSubmit} disabled={submitDisabled}>
				{mode === "create" ? createLabel : saveLabel}
			</Button>
		</div>
	);
});
