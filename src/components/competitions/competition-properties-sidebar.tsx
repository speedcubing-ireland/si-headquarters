"use client";

import { CalendarDays, Circle, PanelRight, Users, X } from "lucide-react";
import { useCallback, useState } from "react";

import {
	EditableCompLeadCell,
	EditableLeadDelegateCell,
	EditableOrganisersCell,
	EditablePhaseCell,
} from "@/components/competitions/editable-phase-and-roles";
import { PropertyRow } from "@/components/shared/property-editors/property-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { useCompetitionMutations } from "@/hooks/use-convex-data";
import type { Competition, Task } from "@/data/types-new";
import { formatDateShort } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

interface CompetitionPropertiesSidebarProps {
	competition: Competition;
	tasks: Task[];
	/**
	 * Render mode:
	 * - 'sidebar': Desktop sidebar + mobile FAB/Sheet (default)
	 * - 'popover': Popover trigger for header use
	 */
	renderMode?: "sidebar" | "popover";
	/** When renderMode is 'popover', this controls the popover open state */
	open?: boolean;
	/** When renderMode is 'popover', this is called when open state changes */
	onOpenChange?: (open: boolean) => void;
	/** Optional className for the popover trigger button */
	triggerClassName?: string;
}

export function CompetitionPropertiesSidebar({
	competition,
	tasks,
	renderMode = "sidebar",
	open: controlledOpen,
	onOpenChange,
	triggerClassName,
}: CompetitionPropertiesSidebarProps) {
	const { updateCompetition } = useCompetitionMutations();
	const [internalOpen, setInternalOpen] = useState(false);
	const [dateOpen, setDateOpen] = useState(false);

	// Use controlled state for popover mode, internal state for sheet mode
	const isOpen = renderMode === "popover" ? controlledOpen : internalOpen;
	const setIsOpen =
		renderMode === "popover" ? (onOpenChange ?? (() => {})) : setInternalOpen;

	const totalTasks = tasks.length;
	const completedTasks = tasks.filter((task) => task.status === "done").length;
	const inProgressTasks = tasks.filter(
		(task) => task.status === "in-progress",
	).length;

	const handleSetDateRange = useCallback(
		(range: { from?: Date; to?: Date }) => {
			void updateCompetition(competition.id, {
				compStart:
					range.from?.toISOString().split("T")[0] || competition.compStart,
				compEnd: range.to?.toISOString().split("T")[0] || competition.compEnd,
			});
		},
		[
			competition.id,
			competition.compStart,
			competition.compEnd,
			updateCompetition,
		],
	);

	const sidebarContent = (
		<div className="flex flex-col gap-6 py-5 px-5">
			{/* Properties Section */}
			<section className="flex flex-col gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Properties
				</h3>
				<div className="flex flex-col gap-1">
					{/* Phase - uses EditablePhaseCell */}
					<PropertyRow label="Phase" icon={<Circle className="size-3.5" />}>
						<EditablePhaseCell competition={competition} />
					</PropertyRow>

					{/* Date Range - inline calendar picker */}
					<PropertyRow
						label="Dates"
						icon={<CalendarDays className="size-3.5" />}
					>
						<DropdownMenu open={dateOpen} onOpenChange={setDateOpen}>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm" className="h-7 px-2">
									<span className="text-sm">
										{formatDateShort(competition.compStart)} –{" "}
										{formatDateShort(competition.compEnd)}
									</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="w-auto p-0" align="end">
								<Calendar
									mode="range"
									selected={{
										from: new Date(competition.compStart),
										to: new Date(competition.compEnd),
									}}
									onSelect={(range) => {
										if (range?.from || range?.to) {
											handleSetDateRange(range);
										}
										setDateOpen(false);
									}}
									numberOfMonths={1}
								/>
							</DropdownMenuContent>
						</DropdownMenu>
					</PropertyRow>

					{/* Task Stats (read-only) */}
					<PropertyRow label="Tasks">
						<span className="text-sm text-muted-foreground">
							<span className="text-foreground font-medium">
								{completedTasks}
							</span>{" "}
							done ·{" "}
							<span className="text-foreground font-medium">
								{inProgressTasks}
							</span>{" "}
							in progress ·{" "}
							<span className="text-foreground font-medium">{totalTasks}</span>{" "}
							total
						</span>
					</PropertyRow>
				</div>
			</section>

			<Separator />

			{/* People Section */}
			<section className="flex flex-col gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					People
				</h3>
				<div className="flex flex-col gap-1">
					{/* Competition Lead */}
					<PropertyRow label="Competition lead">
						<EditableCompLeadCell competition={competition} />
					</PropertyRow>

					{/* Lead Delegate */}
					<PropertyRow label="Lead delegate">
						<EditableLeadDelegateCell competition={competition} />
					</PropertyRow>

					{/* Organisers */}
					<PropertyRow label="Organisers" icon={<Users className="size-3.5" />}>
						<EditableOrganisersCell competition={competition} />
					</PropertyRow>
				</div>
			</section>

			<Separator />

			{/* Phases Section */}
			<section className="flex flex-col gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					All Phases
				</h3>
				<div className="flex flex-col gap-0.5">
					{competition.phases.map((phase, index) => {
						const isCurrent = index === competition.currentPhaseIdx;

						return (
							<button
								key={phase.id}
								type="button"
								onClick={() => {
									void updateCompetition(competition.id, {
										currentPhaseId: phase.id,
									});
								}}
								className={cn(
									"flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
									isCurrent
										? "bg-accent text-foreground"
										: "hover:bg-accent text-muted-foreground",
								)}
							>
								<div className="flex items-center gap-2">
									<Circle
										className={cn(
											"size-2",
											isCurrent
												? "text-warning fill-warning"
												: "text-muted-foreground/40",
										)}
									/>
									<span className={isCurrent ? "font-medium" : ""}>
										{phase.name}
									</span>
								</div>
								{isCurrent && (
									<Badge
										variant="outline"
										className="h-5 border-border bg-background text-[10px] font-normal"
									>
										Current
									</Badge>
								)}
							</button>
						);
					})}
				</div>
			</section>
		</div>
	);

	if (renderMode === "popover") {
		return (
			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
					<PopoverHeader className="px-5 py-4 border-b">
						<div className="flex items-center justify-between">
							<PopoverTitle className="text-sm">Properties</PopoverTitle>
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
						{sidebarContent}
					</ScrollArea>
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<>
			{/* Desktop Sidebar */}
			<aside className="hidden lg:block w-80 border-l border-border bg-background">
				<ScrollArea className="h-full">{sidebarContent}</ScrollArea>
			</aside>

			{/* Mobile Sheet */}
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
						<SheetTitle className="text-sm">Properties</SheetTitle>
					</SheetHeader>
					<ScrollArea className="h-[calc(100vh-60px)]">
						{sidebarContent}
					</ScrollArea>
				</SheetContent>
			</Sheet>
		</>
	);
}
