"use client";

import { PanelRight, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface PropertiesSidebarLayoutProps {
	renderMode?: "sidebar" | "popover";

	open?: boolean;

	onOpenChange?: (open: boolean) => void;

	title?: string;

	triggerClassName?: string;

	showMobileTrigger?: boolean;

	children: ReactNode;
}

export function PropertiesSidebarLayout({
	renderMode = "sidebar",
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	title = "Properties",
	triggerClassName,
	showMobileTrigger = true,
	children,
}: PropertiesSidebarLayoutProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const isOpen = renderMode === "popover" ? controlledOpen : internalOpen;
	const setIsOpen =
		renderMode === "popover"
			? (controlledOnOpenChange ?? (() => {}))
			: setInternalOpen;

	if (renderMode === "popover") {
		return (
			<Sheet open={isOpen} onOpenChange={setIsOpen}>
				<SheetContent
					side="right"
					className="w-[min(22rem,100vw-0.75rem)] p-0 sm:w-80"
				>
					<SheetHeader className="border-b px-4 py-3 sm:px-5 sm:py-4">
						<div className="flex items-center justify-between">
							<SheetTitle className="text-sm">{title}</SheetTitle>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 -mr-2"
								onClick={() => setIsOpen(false)}
							>
								<X className="size-4" />
							</Button>
						</div>
					</SheetHeader>
					<ScrollArea className="h-[calc(100vh-60px)]">{children}</ScrollArea>
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<>
			<aside className="hidden lg:block w-80 border-l border-border bg-background">
				<ScrollArea className="h-full">{children}</ScrollArea>
			</aside>

			{showMobileTrigger ? (
				<Sheet open={isOpen} onOpenChange={setIsOpen}>
					<SheetTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							className={cn(
								"lg:hidden fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 size-11 rounded-full shadow-lg",
								triggerClassName,
							)}
						>
							<PanelRight className="size-4" />
						</Button>
					</SheetTrigger>
					<SheetContent
						side="right"
						className="w-[min(22rem,100vw-0.75rem)] p-0 sm:w-80"
					>
						<SheetHeader className="border-b px-4 py-3 sm:px-5 sm:py-4">
							<SheetTitle className="text-sm">{title}</SheetTitle>
						</SheetHeader>
						<ScrollArea className="h-[calc(100vh-60px)]">{children}</ScrollArea>
					</SheetContent>
				</Sheet>
			) : null}
		</>
	);
}
