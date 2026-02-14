import type { ReactNode } from "react";
import {
	Dialog,
	DialogContent,
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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-[720px]">
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
			</DialogContent>
		</Dialog>
	);
}
