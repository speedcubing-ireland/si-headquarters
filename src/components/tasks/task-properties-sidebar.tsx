"use client";

import { format } from "date-fns";
import {
	Check,
	CheckCircle2,
	Clock,
	PanelRight,
	Plus,
	Shield,
	Trash2,
	X,
	XCircle,
} from "lucide-react";
import { useState } from "react";

import { PropertyRow } from "@/components/shared/property-editors/property-row";
import {
	EditableTaskAssignee,
	EditableTaskOwner,
	EditableTaskPriority,
	EditableTaskStatus,
} from "@/components/tasks/editable-cells";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { useUsers, useTeams, useTaskMutations } from "@/hooks/use-convex-data";
import type { Task, Team, User } from "@/data/types-new";
import { cn } from "@/lib/utils";

interface TaskPropertiesSidebarProps {
	task: Task;
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
	/** When provided, shows a Delete task button that calls this (e.g. to open confirm dialog) */
	onDeleteClick?: () => void;
}

function ApprovalBadge({
	approver,
	isApproved,
	isCurrentUser,
	onRemove,
	onApprove,
	onUnapprove,
}: {
	approver: Team | User;
	isApproved: boolean;
	isCurrentUser: boolean;
	onRemove: () => void;
	onApprove: () => void;
	onUnapprove: () => void;
}) {
	const isTeam = "members" in approver;

	return (
		<div
			className={cn(
				"flex items-center gap-2 px-2 py-1.5 rounded-md border text-sm group",
				isApproved
					? "border-green-500/30 bg-green-500/10"
					: "border-muted bg-muted/50",
			)}
		>
			<div
				className={cn(
					"flex items-center justify-center w-5 h-5 rounded-full",
					isApproved ? "bg-green-500 text-white" : "bg-muted-foreground/20",
				)}
			>
				{isApproved ? (
					<Check className="size-3" />
				) : (
					<Clock className="size-3 text-muted-foreground" />
				)}
			</div>

			<div className="flex-1 min-w-0">
				<div className="font-medium truncate">{approver.name}</div>
				<div className="text-xs text-muted-foreground">
					{isTeam ? "Team" : isCurrentUser ? "You" : "User"} •{" "}
					{isApproved ? "Approved" : "Pending"}
				</div>
			</div>

			<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
				{isCurrentUser &&
					(isApproved ? (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={onUnapprove}
							title="Unapprove"
						>
							<XCircle className="size-3.5 text-red-500" />
						</Button>
					) : (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={onApprove}
							title="Approve"
						>
							<CheckCircle2 className="size-3.5 text-green-500" />
						</Button>
					))}
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={onRemove}
					title="Remove approver"
				>
					<Trash2 className="size-3.5 text-muted-foreground" />
				</Button>
			</div>
		</div>
	);
}

function AddApproverDialog({
	open,
	onOpenChange,
	task,
	onAdd,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	task: Task;
	onAdd: (approver: Team | User) => void;
}) {
	const { users } = useUsers();
	const { teams } = useTeams();
	const [search, setSearch] = useState("");

	const existingApproverIds = new Set([
		...task.requiredApprovalBy.map((a) => a.id),
		...(task.assignee ? [task.assignee.id] : []),
	]);

	const filteredUsers = users.filter(
		(u) =>
			!existingApproverIds.has(u.id) &&
			u.name.toLowerCase().includes(search.toLowerCase()),
	);

	const filteredTeams = teams.filter(
		(t) =>
			!existingApproverIds.has(t.id) &&
			t.name.toLowerCase().includes(search.toLowerCase()),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[400px]">
				<DialogHeader>
					<DialogTitle>Add Required Approver</DialogTitle>
				</DialogHeader>
				<Command>
					<CommandInput
						placeholder="Search people or teams..."
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						{filteredTeams.length > 0 && (
							<CommandGroup heading="Teams">
								{filteredTeams.map((team) => (
									<CommandItem
										key={team.id}
										onSelect={() => {
											onAdd(team);
											onOpenChange(false);
											setSearch("");
										}}
									>
										<div className="flex items-center gap-2">
											<div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
												T
											</div>
											<span>{team.name}</span>
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{filteredUsers.length > 0 && (
							<CommandGroup heading="People">
								{filteredUsers.map((user) => (
									<CommandItem
										key={user.id}
										onSelect={() => {
											onAdd(user);
											onOpenChange(false);
											setSearch("");
										}}
									>
										<div className="flex items-center gap-2">
											{user.avatarUrl ? (
												<img
													src={user.avatarUrl}
													alt={user.name}
													className="w-6 h-6 rounded-full"
												/>
											) : null}
											<span>{user.name}</span>
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}

export function TaskPropertiesSidebar({
	task,
	renderMode = "sidebar",
	open: controlledOpen,
	onOpenChange,
	triggerClassName,
	onDeleteClick,
}: TaskPropertiesSidebarProps) {
	const {
		updateTask,
		addRequiredApprover,
		removeRequiredApprover,
		approveTask,
		unapproveTask,
	} = useTaskMutations();
	const { users } = useUsers();
	const currentUser = users[0];

	const [internalOpen, setInternalOpen] = useState(false);
	const [dateOpen, setDateOpen] = useState(false);
	const [addApproverOpen, setAddApproverOpen] = useState(false);

	// Use controlled state for popover mode, internal state for sheet mode
	const isOpen = renderMode === "popover" ? controlledOpen : internalOpen;
	const setIsOpen =
		renderMode === "popover" ? (onOpenChange ?? (() => {})) : setInternalOpen;

	const approvalStatus = (() => {
		const required = task.requiredApprovalBy;
		const approved = task.approvedBy;
		const approvedUserIds = new Set(approved.map((a) => a.id));

		// Check if each required approver is satisfied
		const isApproved = (approver: Team | User): boolean => {
			if ("members" in approver) {
				// Team: check if any member has approved
				return approver.members.some((m) => approvedUserIds.has(m.id));
			}
			// User: check if this user has approved
			return approvedUserIds.has(approver.id);
		};

		const approvedCount = required.filter(isApproved).length;

		return {
			required,
			approved,
			approvedCount,
			requiredCount: required.length,
			isFullyApproved: required.length > 0 && required.every(isApproved),
			pending: required.filter((r) => !isApproved(r)),
		};
	})();

	const isCurrentUserApprover = (approver: Team | User) => {
		if ("members" in approver) {
			// It's a team - check if current user is a member
			return approver.members.some((m) => m.id === currentUser?.id);
		}
		// It's a user
		return approver.id === currentUser?.id;
	};

	const handleAddApprover = (approver: Team | User) => {
		if (!currentUser) return;
		void addRequiredApprover(task.id, approver, currentUser);
	};

	const handleRemoveApprover = (approverId: string) => {
		if (!currentUser) return;
		// Encode the approver key based on whether it's a user or team
		const approver = task.requiredApprovalBy.find((a) => a.id === approverId);
		if (!approver) return;
		const approverKey =
			"members" in approver ? `team:${approverId}` : `user:${approverId}`;
		void removeRequiredApprover(task.id, approverKey, currentUser);
	};

	const handleApprove = () => {
		if (!currentUser) return;
		void approveTask(task.id, currentUser);
	};

	const handleUnapprove = () => {
		if (!currentUser) return;
		void unapproveTask(task.id, currentUser);
	};

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
				</div>
			</section>

			<Separator />

			{/* Approval Section */}
			<section className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
						<Shield className="size-3.5" />
						Approvals
					</h3>
					{approvalStatus.requiredCount > 0 && (
						<span
							className={cn(
								"text-xs font-medium",
								approvalStatus.isFullyApproved
									? "text-green-500"
									: "text-amber-500",
							)}
						>
							{approvalStatus.approvedCount}/{approvalStatus.requiredCount}
						</span>
					)}
				</div>

				{approvalStatus.requiredCount === 0 ? (
					<div className="text-sm text-muted-foreground">
						No approvals required
					</div>
				) : (
					<div className="flex flex-col gap-1.5">
						{approvalStatus.required.map((approver) => {
							const isApproved = (() => {
								if ("members" in approver) {
									// Team: check if any member has approved
									const approvedUserIds = new Set(
										task.approvedBy.map((a) => a.id),
									);
									return approver.members.some((m) =>
										approvedUserIds.has(m.id),
									);
								}
								// User: check if this user has approved
								return task.approvedBy.some((a) => a.id === approver.id);
							})();
							return (
								<ApprovalBadge
									key={approver.id}
									approver={approver}
									isApproved={isApproved}
									isCurrentUser={isCurrentUserApprover(approver)}
									onRemove={() => handleRemoveApprover(approver.id)}
									onApprove={handleApprove}
									onUnapprove={handleUnapprove}
								/>
							);
						})}
					</div>
				)}

				<Button
					variant="ghost"
					size="sm"
					className="justify-start text-muted-foreground hover:text-foreground mt-1"
					onClick={() => setAddApproverOpen(true)}
				>
					<Plus className="size-3.5 mr-1.5" />
					Add approver
				</Button>

				{task.status === "done" &&
					approvalStatus.requiredCount > 0 &&
					!approvalStatus.isFullyApproved && (
						<div className="mt-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600">
							Task is marked done but missing required approvals (
							{approvalStatus.pending.length} pending)
						</div>
					)}
			</section>

			<Separator />

			{/* Metadata Section */}
			<section className="flex flex-col gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Details
				</h3>
				<div className="flex flex-col gap-1">
					<PropertyRow label="Due date">
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
										void updateTask(task.id, {
											dueDate: date ? date.toISOString().split("T")[0] : null,
										});
										setDateOpen(false);
									}}
								/>
							</DropdownMenuContent>
						</DropdownMenu>
					</PropertyRow>

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

			{onDeleteClick && (
				<>
					<Separator />
					<section className="pt-1">
						<Button
							variant="destructive"
							size="sm"
							onClick={onDeleteClick}
							className="w-full gap-2"
						>
							<Trash2 className="size-4" />
							Delete task
						</Button>
					</section>
				</>
			)}
		</div>
	);

	return (
		<>
			{/* Dialog for adding approvers */}
			<AddApproverDialog
				open={addApproverOpen}
				onOpenChange={setAddApproverOpen}
				task={task}
				onAdd={handleAddApprover}
			/>

			{renderMode === "popover" ? (
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
			) : (
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
			)}
		</>
	);
}
