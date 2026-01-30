"use client";

import { format } from "date-fns";
import { CalendarDays, Circle, Tag } from "lucide-react";
import { useState } from "react";

import { PropertyRow } from "@/components/shared/property-editors/property-row";
import {
	EditableTaskAssignee,
	EditableTaskLabels,
	EditableTaskOwner,
	EditableTaskPriority,
	EditableTaskStatus,
} from "@/components/tasks/editable-cells";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { useDataV2 } from "@/data/data-store-v2";
import type { Task } from "@/data/types-new";

interface TaskPropertiesSidebarProps {
	task: Task;
}

export function TaskPropertiesSidebar({ task }: TaskPropertiesSidebarProps) {
	const updateTask = useDataV2((state) => state.updateTask);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [dateOpen, setDateOpen] = useState(false);

	const sidebarContent = (
		<div className="flex flex-col gap-6 py-5 px-5">
			{/* Main Properties */}
			<section className="flex flex-col gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Properties
				</h3>
				<div className="flex flex-col gap-1">
					{/* Status */}
					<PropertyRow label="Status">
						<EditableTaskStatus status={task.status} taskId={task.id} />
					</PropertyRow>

					{/* Priority */}
					<PropertyRow label="Priority">
						<EditableTaskPriority priority={task.priority} taskId={task.id} />
					</PropertyRow>

					{/* Assignee */}
					<PropertyRow label="Assignee">
						<EditableTaskAssignee assignee={task.assignee} taskId={task.id} />
					</PropertyRow>

					{/* Owner */}
					<PropertyRow label="Owner">
						<EditableTaskOwner owner={task.owner} taskId={task.id} />
					</PropertyRow>

					{/* Due Date */}
					<PropertyRow
						label="Due date"
						icon={<CalendarDays className="size-3.5" />}
					>
						<DropdownMenu open={dateOpen} onOpenChange={setDateOpen}>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm" className="h-7 px-2">
									{task.dueDate ? (
										<span className="text-sm">
											{format(new Date(task.dueDate), "MMM d")}
										</span>
									) : (
										<span className="text-sm text-muted-foreground">
											Set due date...
										</span>
									)}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="w-auto p-0" align="end">
								<Calendar
									mode="single"
									selected={task.dueDate ? new Date(task.dueDate) : undefined}
									onSelect={(date) => {
										updateTask(task.id, {
											dueDate: date ? date.toISOString().split("T")[0] : null,
										});
										setDateOpen(false);
									}}
								/>
							</DropdownMenuContent>
						</DropdownMenu>
					</PropertyRow>
				</div>
			</section>

			<Separator />

			{/* Labels Section */}
			<section className="flex flex-col gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Labels
				</h3>
				<PropertyRow label="Labels" icon={<Tag className="size-3.5" />}>
					<EditableTaskLabels labels={task.labels} taskId={task.id} wrap />
				</PropertyRow>
			</section>

			<Separator />

			{/* Metadata Section */}
			<section className="flex flex-col gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Details
				</h3>
				<div className="flex flex-col gap-1">
					<PropertyRow label="Created">
						<span className="text-sm text-muted-foreground">
							{format(new Date(task.createdAt), "MMM d, yyyy")}
						</span>
					</PropertyRow>

					<PropertyRow label="Updated">
						<span className="text-sm text-muted-foreground">
							{format(new Date(task.updatedAt), "MMM d, yyyy")}
						</span>
					</PropertyRow>

					<PropertyRow label="ID">
						<span className="text-sm font-mono text-muted-foreground">
							{task.identifier}
						</span>
					</PropertyRow>
				</div>
			</section>
		</div>
	);

	return (
		<>
			{/* Desktop Sidebar */}
			<aside className="hidden lg:block w-80 border-l border-border bg-background">
				<ScrollArea className="h-full">{sidebarContent}</ScrollArea>
			</aside>

			{/* Mobile Sheet */}
			<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
				<SheetTrigger asChild>
					<Button
						variant="outline"
						size="icon"
						className="lg:hidden fixed bottom-4 right-4 z-50 h-10 w-10 rounded-full shadow-lg"
					>
						<Circle className="size-4" />
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
