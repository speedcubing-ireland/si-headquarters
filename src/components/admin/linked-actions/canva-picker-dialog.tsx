import type { ReactNode } from "react";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import {
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface CanvaPickerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	searchPlaceholder: string;
	searchValue: string;
	onSearchChange: (value: string) => void;
	children: ReactNode;
}

export function CanvaPickerDialog({
	open,
	onOpenChange,
	title,
	description,
	searchPlaceholder,
	searchValue,
	onSearchChange,
	children,
}: CanvaPickerDialogProps) {
	return (
		<ResponsiveModal
			open={open}
			onOpenChange={onOpenChange}
			dialogContentClassName="sm:max-w-[720px]"
			sheetContentClassName="p-6"
		>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<Input
						value={searchValue}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder={searchPlaceholder}
					/>
					{children}
				</div>
		</ResponsiveModal>
	);
}
