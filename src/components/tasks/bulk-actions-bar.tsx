import {
	Archive,
	ArrowRight,
	CheckSquare,
	ChevronDown,
	LayoutList,
	MoreHorizontal,
	Trash2,
	User as UserIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDataV2 } from "@/data/data-store-v2";
import type {
	TaskLabel,
	TaskPriority,
	TaskStatus,
	User,
} from "@/data/types-new";
import { TASK_PRIORITY, TASK_STATUS } from "@/data/types-new";
import { getStatusIcon } from "@/lib/task-utils";

interface BulkActionsBarProps {
	selectedTaskIds: string[];
	totalTasks: number;
	onClearSelection: () => void;
	onSelectAll: () => void;
}

export function BulkActionsBar({
	selectedTaskIds,
	totalTasks,
	onClearSelection,
	onSelectAll,
}: BulkActionsBarProps) {
	const [isArchiving, setIsArchiving] = useState(false);

	const tasks = useDataV2((state) => state.tasks);
	const users = useDataV2((state) => state.users);
	const labels = useDataV2((state) => state.labels);
	const updateTask = useDataV2((state) => state.updateTask);
	const archiveTasks = useDataV2((state) => state.archiveTasks);
	const deleteTasks = useDataV2((state) => state.deleteTasks);

	const selectedCount = selectedTaskIds.length;
	const allSelected = selectedCount === totalTasks && totalTasks > 0;

	// Keyboard shortcuts: Escape to clear selection
	useEffect(() => {
		if (selectedCount === 0) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClearSelection();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [selectedCount, onClearSelection]);

	const handleStatusChange = (status: TaskStatus) => {
		for (const taskId of selectedTaskIds) {
			updateTask(taskId, { status });
		}
		// Selection persists after action (Linear-style)
	};

	const handlePriorityChange = (priority: TaskPriority) => {
		for (const taskId of selectedTaskIds) {
			updateTask(taskId, { priority });
		}
		// Selection persists after action (Linear-style)
	};

	const handleAssigneeChange = (user: User | null) => {
		for (const taskId of selectedTaskIds) {
			updateTask(taskId, { assignee: user });
		}
		// Selection persists after action (Linear-style)
	};

	const handleLabelToggle = (label: TaskLabel) => {
		for (const taskId of selectedTaskIds) {
			const task = tasks.find((t) => t.id === taskId);
			if (!task) continue;

			const hasLabel = task.labels.some((l) => l.id === label.id);
			const newLabels = hasLabel
				? task.labels.filter((l) => l.id !== label.id)
				: [...task.labels, label];

			updateTask(taskId, { labels: newLabels });
		}
	};

	const handleArchive = () => {
		setIsArchiving(true);
		archiveTasks(selectedTaskIds);
		setIsArchiving(false);
		// Selection persists after action (Linear-style)
	};

	const handleDelete = () => {
		deleteTasks(selectedTaskIds);
		// Selection persists after action (Linear-style)
	};

	if (selectedCount === 0) return null;

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
			<div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3 max-w-full">
				{/* Selection info */}
				<div className="flex items-center gap-2 sm:gap-3 shrink-0">
					<span className="text-sm font-medium text-foreground">
						{selectedCount}{" "}
						<span className="hidden sm:inline">
							{selectedCount === 1 ? "task" : "tasks"} selected
						</span>
					</span>
					{!allSelected && (
						<button
							type="button"
							onClick={onSelectAll}
							className="text-xs sm:text-sm text-primary hover:underline hidden xs:inline"
						>
							Select all {totalTasks}
						</button>
					)}
					<button
						type="button"
						onClick={onClearSelection}
						className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						<span className="hidden sm:inline">Clear</span>
						<span className="sm:hidden">×</span>
					</button>
				</div>

				<div className="h-4 w-px bg-border shrink-0 hidden sm:block" />

				{/* Mobile Actions Dropdown */}
				<div className="sm:hidden flex items-center gap-1">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-8 gap-1 px-2">
								<span>Actions</span>
								<ChevronDown className="size-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-56">
							{/* Status Submenu */}
							<DropdownMenuItem
								className="font-medium text-muted-foreground"
								disabled
							>
								Set Status
							</DropdownMenuItem>
							{TASK_STATUS.map((status) => {
								const Icon = getStatusIcon(status);
								return (
									<DropdownMenuItem
										key={status}
										onClick={() => handleStatusChange(status)}
									>
										<Icon className="size-4 mr-2" />
										<span className="capitalize">
											{status.replace("-", " ")}
										</span>
									</DropdownMenuItem>
								);
							})}

							<DropdownMenuSeparator />

							{/* Priority Submenu */}
							<DropdownMenuItem
								className="font-medium text-muted-foreground"
								disabled
							>
								Set Priority
							</DropdownMenuItem>
							{TASK_PRIORITY.map((priority) => (
								<DropdownMenuItem
									key={priority}
									onClick={() => handlePriorityChange(priority)}
								>
									<span
										className={`size-2 rounded-full mr-2 ${
											priority === "urgent"
												? "bg-red-500"
												: priority === "high"
													? "bg-orange-500"
													: priority === "medium"
														? "bg-yellow-500"
														: "bg-gray-400"
										}`}
									/>
									<span className="capitalize">{priority}</span>
								</DropdownMenuItem>
							))}

							<DropdownMenuSeparator />

							{/* Assignee Submenu */}
							<DropdownMenuItem
								className="font-medium text-muted-foreground"
								disabled
							>
								Assign to
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleAssigneeChange(null)}>
								<span className="text-muted-foreground">Unassigned</span>
							</DropdownMenuItem>
							{users.map((user) => (
								<DropdownMenuItem
									key={user.id}
									onClick={() => handleAssigneeChange(user)}
								>
									<img
										src={user.avatarUrl}
										alt=""
										className="size-5 rounded-full mr-2"
									/>
									{user.name}
								</DropdownMenuItem>
							))}

							<DropdownMenuSeparator />

							{/* Labels Submenu */}
							<DropdownMenuItem
								className="font-medium text-muted-foreground"
								disabled
							>
								Labels
							</DropdownMenuItem>
							{labels.map((label) => (
								<DropdownMenuItem
									key={label.id}
									onClick={() => handleLabelToggle(label)}
								>
									<span
										className="size-2 rounded-full mr-2"
										style={{ backgroundColor: label.color }}
									/>
									{label.name}
								</DropdownMenuItem>
							))}

							<DropdownMenuSeparator />

							{/* Archive & Delete */}
							<DropdownMenuItem onClick={handleArchive}>
								<Archive className="size-4 mr-2" />
								Archive
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={handleDelete}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="size-4 mr-2" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Desktop Actions - compact ghost buttons */}
				<div className="hidden sm:flex items-center gap-1 overflow-x-auto">
					{/* Status Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
								<CheckSquare className="size-4" />
								<span className="hidden sm:inline">Status</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							{TASK_STATUS.map((status) => {
								const Icon = getStatusIcon(status);
								return (
									<DropdownMenuItem
										key={status}
										onClick={() => handleStatusChange(status)}
									>
										<Icon className="size-4 mr-2" />
										<span className="capitalize">
											{status.replace("-", " ")}
										</span>
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Priority Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
								<ArrowRight className="size-4" />
								<span className="hidden sm:inline">Priority</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							{TASK_PRIORITY.map((priority) => (
								<DropdownMenuItem
									key={priority}
									onClick={() => handlePriorityChange(priority)}
								>
									<span
										className={`size-2 rounded-full mr-2 ${
											priority === "urgent"
												? "bg-red-500"
												: priority === "high"
													? "bg-orange-500"
													: priority === "medium"
														? "bg-yellow-500"
														: "bg-gray-400"
										}`}
									/>
									<span className="capitalize">{priority}</span>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Assignee Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
								<UserIcon className="size-4" />
								<span className="hidden sm:inline">Assignee</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-56">
							<DropdownMenuItem onClick={() => handleAssigneeChange(null)}>
								<span className="text-muted-foreground">Unassigned</span>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							{users.map((user) => (
								<DropdownMenuItem
									key={user.id}
									onClick={() => handleAssigneeChange(user)}
								>
									<img
										src={user.avatarUrl}
										alt=""
										className="size-5 rounded-full mr-2"
									/>
									{user.name}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Labels Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
								<LayoutList className="size-4" />
								<span className="hidden sm:inline">Labels</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-56">
							{labels.map((label) => (
								<DropdownMenuItem
									key={label.id}
									onClick={() => handleLabelToggle(label)}
								>
									<span
										className="size-2 rounded-full mr-2"
										style={{ backgroundColor: label.color }}
									/>
									{label.name}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="flex-1" />

				{/* Right side actions */}
				<div className="flex items-center gap-1 shrink-0">
					<Button
						variant="ghost"
						size="sm"
						className="h-8 gap-1.5 px-2 hidden sm:flex"
						onClick={handleArchive}
						disabled={isArchiving}
					>
						<Archive className="size-4" />
						<span className="hidden sm:inline">Archive</span>
					</Button>

					{/* More actions dropdown (includes delete) */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 px-2">
								<MoreHorizontal className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={handleDelete}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="size-4 mr-2" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>
	);
}
