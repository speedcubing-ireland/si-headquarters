"use client";

import { format } from "date-fns";
import {
	AlertTriangle,
	Check,
	CheckCircle2,
	Clock,
	Link2,
	Plus,
	Shield,
	Trash2,
	XCircle,
} from "lucide-react";
import { useState } from "react";

import { PropertyRow } from "@/components/shared/property-editors/property-row";
import { PropertiesSidebarLayout } from "@/components/shared/properties-sidebar-layout";
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
import { Separator } from "@/components/ui/separator";
import {
	useUsers,
	useTeams,
	useTaskMutations,
	useTasks,
} from "@/hooks/use-convex-data";
import type { Task, Team, User } from "@/data/types-new";
import { cn } from "@/lib/utils";

interface TaskPropertiesSidebarProps {
	task: Task;
	renderMode?: "sidebar" | "popover";
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	triggerClassName?: string;
	showMobileTrigger?: boolean;
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

function AddBlockingTaskDialog({
	open,
	onOpenChange,
	task,
	onAddBlockingTask,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	task: Task;
	onAddBlockingTask: (blockingTaskId: Task["id"]) => void;
}) {
	const { tasks } = useTasks(false);
	const [search, setSearch] = useState("");

	const existingBlockingTaskIds = new Set(
		task.blockedBy.map((relation) => relation.task.id),
	);
	const currentCompetitionId =
		task.parent?.type === "competition" ? task.parent.linkedId : null;
	const filteredTasks = tasks.filter((candidate) => {
		if (candidate.id === task.id) {
			return false;
		}
		if (existingBlockingTaskIds.has(candidate.id)) {
			return false;
		}
		const candidateCompetitionId =
			candidate.parent?.type === "competition"
				? candidate.parent.linkedId
				: null;
		if (candidateCompetitionId !== currentCompetitionId) {
			return false;
		}
		const candidateText =
			`${candidate.identifier} ${candidate.title}`.toLowerCase();
		return candidateText.includes(search.toLowerCase());
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[520px]">
				<DialogHeader>
					<DialogTitle>Add Blocking Task</DialogTitle>
				</DialogHeader>
				<Command>
					<CommandInput
						placeholder="Search tasks..."
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList>
						<CommandEmpty>No matching tasks.</CommandEmpty>
						{filteredTasks.length > 0 && (
							<CommandGroup heading="Tasks">
								{filteredTasks.map((candidate) => (
									<CommandItem
										key={candidate.id}
										onSelect={() => {
											onAddBlockingTask(candidate.id);
											onOpenChange(false);
											setSearch("");
										}}
									>
										<div className="flex min-w-0 flex-col">
											<span className="truncate text-xs text-muted-foreground">
												{candidate.identifier}
											</span>
											<span className="truncate text-sm">
												{candidate.title}
											</span>
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
	showMobileTrigger = true,
	onDeleteClick,
}: TaskPropertiesSidebarProps) {
	const {
		updateTask,
		addRequiredApprover,
		removeRequiredApprover,
		addBlockingRelation,
		removeBlockingRelation,
		approveTask,
		unapproveTask,
	} = useTaskMutations();
	const { users } = useUsers();
	const currentUser = users[0];

	const [dateOpen, setDateOpen] = useState(false);
	const [addApproverOpen, setAddApproverOpen] = useState(false);
	const [addBlockingOpen, setAddBlockingOpen] = useState(false);

	const approvalStatus = (() => {
		const required = task.requiredApprovalBy;
		const approved = task.approvedBy;
		const approvedUserIds = new Set(approved.map((a) => a.id));
		const isApproved = (approver: Team | User): boolean => {
			if ("members" in approver) {
				return approver.members.some((m) => approvedUserIds.has(m.id));
			}
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
			return approver.members.some((m) => m.id === currentUser?.id);
		}
		return approver.id === currentUser?.id;
	};

	const handleAddApprover = (approver: Team | User) => {
		void addRequiredApprover(task.id, approver);
	};

	const handleRemoveApprover = (approverId: string) => {
		const approver = task.requiredApprovalBy.find((a) => a.id === approverId);
		if (!approver) return;
		const approverKey =
			"members" in approver ? `team:${approverId}` : `user:${approverId}`;
		void removeRequiredApprover(task.id, approverKey);
	};

	const handleApprove = () => {
		void approveTask(task.id);
	};

	const handleUnapprove = () => {
		void unapproveTask(task.id);
	};

	const handleAddBlockingTask = (blockingTaskId: Task["id"]) => {
		void addBlockingRelation(task.id, blockingTaskId);
	};

	const handleRemoveBlockingTask = (blockingTaskId: Task["id"]) => {
		void removeBlockingRelation(task.id, blockingTaskId);
	};

	const handleRemoveBlockedTask = (blockedTaskId: Task["id"]) => {
		void removeBlockingRelation(blockedTaskId, task.id);
	};

	const sidebarContent = (
		<div className="flex flex-col gap-6 px-4 py-4 sm:px-5 sm:py-5">
			<section className="flex flex-col gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Properties
				</h3>
				<div className="flex flex-col gap-1">
					<PropertyRow label="Status">
						<EditableTaskStatus status={task.status} taskId={task.id} />
					</PropertyRow>

					<PropertyRow label="Priority">
						<EditableTaskPriority priority={task.priority} taskId={task.id} />
					</PropertyRow>

					<PropertyRow label="Assignee">
						<EditableTaskAssignee assignee={task.assignee} taskId={task.id} />
					</PropertyRow>

					<PropertyRow label="Owner">
						<EditableTaskOwner owner={task.owner} taskId={task.id} />
					</PropertyRow>
				</div>
			</section>

			<Separator />

			<section className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
						<Link2 className="size-3.5" />
						Dependencies
					</h3>
					{task.isBlocked && (
						<span className="text-xs font-medium text-amber-600">
							{task.unresolvedBlockerCount} active
						</span>
					)}
				</div>

				<div className="space-y-1">
					<div className="text-xs font-medium text-muted-foreground">
						Blocked by
					</div>
					{task.blockedBy.length === 0 ? (
						<div className="text-sm text-muted-foreground">
							No blocking tasks
						</div>
					) : (
						<div className="flex flex-col gap-1.5">
							{task.blockedBy.map((relation) => (
								<div
									key={relation.task.id}
									className={cn(
										"flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm",
										relation.isResolved
											? "border-green-500/30 bg-green-500/10"
											: "border-amber-500/30 bg-amber-500/10",
									)}
								>
									{relation.isResolved ? (
										<CheckCircle2 className="size-4 shrink-0 text-green-500" />
									) : (
										<AlertTriangle className="size-4 shrink-0 text-amber-500" />
									)}
									<div className="min-w-0 flex-1">
										<div className="truncate font-medium">
											{relation.task.identifier} {relation.task.title}
										</div>
										<div className="text-xs text-muted-foreground">
											{relation.isResolved ? "Resolved" : "Blocking"}
										</div>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6"
										onClick={() => handleRemoveBlockingTask(relation.task.id)}
										title="Remove blocker"
									>
										<Trash2 className="size-3.5 text-muted-foreground" />
									</Button>
								</div>
							))}
						</div>
					)}
				</div>

				<Button
					variant="ghost"
					size="sm"
					className="justify-start text-muted-foreground hover:text-foreground"
					onClick={() => setAddBlockingOpen(true)}
				>
					<Plus className="size-3.5 mr-1.5" />
					Add blocker
				</Button>

				<div className="space-y-1 pt-1">
					<div className="text-xs font-medium text-muted-foreground">
						Blocks
					</div>
					{task.blocks.length === 0 ? (
						<div className="text-sm text-muted-foreground">
							Not blocking other tasks
						</div>
					) : (
						<div className="flex flex-col gap-1.5">
							{task.blocks.map((blockedTask) => (
								<div
									key={blockedTask.id}
									className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
								>
									<Link2 className="size-4 shrink-0 text-muted-foreground" />
									<div className="min-w-0 flex-1">
										<div className="truncate font-medium">
											{blockedTask.identifier} {blockedTask.title}
										</div>
										<div className="text-xs text-muted-foreground">
											Status: {blockedTask.status}
										</div>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6"
										onClick={() => handleRemoveBlockedTask(blockedTask.id)}
										title="Remove dependency"
									>
										<Trash2 className="size-3.5 text-muted-foreground" />
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			</section>

			<Separator />

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
									const approvedUserIds = new Set(
										task.approvedBy.map((a) => a.id),
									);
									return approver.members.some((m) =>
										approvedUserIds.has(m.id),
									);
								}
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
			<AddBlockingTaskDialog
				open={addBlockingOpen}
				onOpenChange={setAddBlockingOpen}
				task={task}
				onAddBlockingTask={handleAddBlockingTask}
			/>
			<AddApproverDialog
				open={addApproverOpen}
				onOpenChange={setAddApproverOpen}
				task={task}
				onAdd={handleAddApprover}
			/>
			<PropertiesSidebarLayout
				renderMode={renderMode}
				open={controlledOpen}
				onOpenChange={onOpenChange}
				title="Properties"
				triggerClassName={triggerClassName}
				showMobileTrigger={showMobileTrigger}
			>
				{sidebarContent}
			</PropertiesSidebarLayout>
		</>
	);
}
