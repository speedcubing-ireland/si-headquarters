"use client";

import { PanelRight, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
} from "@/components/ui/popover";
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
	/** "sidebar" = desktop aside + mobile Sheet; "popover" = Popover only (trigger from parent) */
	renderMode?: "sidebar" | "popover";
	/** When renderMode is "popover", controls open state */
	open?: boolean;
	/** When renderMode is "popover", called when open state changes */
	onOpenChange?: (open: boolean) => void;
	/** Title shown in header (popover and sheet) */
	title?: string;
	/** Optional className for the mobile Sheet trigger button */
	triggerClassName?: string;
	/** Main content (property rows, sections, etc.) */
	children: ReactNode;
}

/**
 * Shared layout for task and competition properties sidebars.
 * Renders either a desktop aside + mobile Sheet, or a Popover (when trigger is controlled by parent).
 */
export function PropertiesSidebarLayout({
	renderMode = "sidebar",
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	title = "Properties",
	triggerClassName,
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
			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
					<PopoverHeader className="px-5 py-4 border-b">
						<div className="flex items-center justify-between">
							<PopoverTitle className="text-sm">{title}</PopoverTitle>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 -mr-2"
								onClick={() => setIsOpen(false)}
							>
								<X className="size-4" />
							</Button>
						</div>
					</PopoverHeader>
					<ScrollArea className="h-[calc(100vh-200px)] max-h-[500px]">
						{children}
					</ScrollArea>
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<>
			<aside className="hidden lg:block w-80 border-l border-border bg-background">
				<ScrollArea className="h-full">{children}</ScrollArea>
			</aside>

			<Sheet open={isOpen} onOpenChange={setIsOpen}>
				<SheetTrigger asChild>
					<Button
						variant="outline"
						size="icon"
						className={cn(
							"lg:hidden fixed bottom-4 right-4 z-50 h-10 w-10 rounded-full shadow-lg",
							triggerClassName,
						)}
					>
						<PanelRight className="size-4" />
					</Button>
				</SheetTrigger>
				<SheetContent side="right" className="w-80 p-0">
					<SheetHeader className="px-5 py-4 border-b">
						<SheetTitle className="text-sm">{title}</SheetTitle>
					</SheetHeader>
					<ScrollArea className="h-[calc(100vh-60px)]">{children}</ScrollArea>
				</SheetContent>
			</Sheet>
		</>
	);
}
