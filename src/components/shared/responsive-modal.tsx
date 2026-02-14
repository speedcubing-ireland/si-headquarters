import type * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface ResponsiveModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
	dialogContentClassName?: string;
	sheetContentClassName?: string;
	showCloseButton?: boolean;
}

export function ResponsiveModal({
	open,
	onOpenChange,
	children,
	dialogContentClassName,
	sheetContentClassName,
	showCloseButton = true,
}: ResponsiveModalProps) {
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent
					side="bottom"
					showCloseButton={showCloseButton}
					className={cn(
						"max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-lg p-0",
						sheetContentClassName,
					)}
				>
					{children}
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={showCloseButton}
				className={dialogContentClassName}
			>
				{children}
			</DialogContent>
		</Dialog>
	);
}
