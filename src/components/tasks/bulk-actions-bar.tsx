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
import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Id } from "@/convex/_generated/dataModel";
import {
	useTasks,
	useUsers,
	useLabels,
	useTaskMutations,
} from "@/hooks/use-convex-data";
import type {
	TaskLabel,
	TaskPriority,
	TaskStatus,
	User,
} from "@/data/types-new";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/data/types-new";
import { getStatusIcon } from "@/lib/task-utils";
import { useTasksListStateContext } from "@/store/tasks-list-context";
import { parseTaskId } from "@/lib/convex-ids";
import { onMutationError } from "@/lib/utils";

interface BulkActionsBarProps {
	totalTasks: number;
	onSelectAll: () => void;
}

export function BulkActionsBar({
	totalTasks,
	onSelectAll,
}: BulkActionsBarProps) {
	const listState = useTasksListStateContext();
	const selectedTaskIds = listState.selectedIds;
	const onClearSelection = listState.clearRowSelection;
	const [isArchiving, setIsArchiving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const typedTaskIds = useMemo(
		() =>
			selectedTaskIds
				.map((id) => parseTaskId(id))
				.filter((id): id is Id<"tasks"> => id !== null),
		[selectedTaskIds],
	);

	const { tasks } = useTasks(false);
	const { users } = useUsers();
	const { labels } = useLabels();
	const { bulkUpdateTasks, archiveTasks, deleteTasks } = useTaskMutations();

	const selectedCount = typedTaskIds.length;
	const allSelected = selectedCount === totalTasks && totalTasks > 0;

	const handleStatusChange = useCallback(
		(status: TaskStatus) => {
			void bulkUpdateTasks(typedTaskIds, { status })
				.then(() => {
					onClearSelection();
				})
				.catch(onMutationError);
		},
		[typedTaskIds, bulkUpdateTasks, onClearSelection],
	);

	const handlePriorityChange = useCallback(
		(priority: TaskPriority) => {
			void bulkUpdateTasks(typedTaskIds, { priority })
				.then(() => {
					onClearSelection();
				})
				.catch(onMutationError);
		},
		[selectedTaskIds, bulkUpdateTasks, onClearSelection],
	);

	const handleAssigneeChange = useCallback(
		(user: User | null) => {
			void bulkUpdateTasks(typedTaskIds, { assignee: user })
				.then(() => {
					onClearSelection();
				})
				.catch(onMutationError);
		},
		[typedTaskIds, bulkUpdateTasks, onClearSelection],
	);

	const handleLabelToggle = useCallback(
		(label: TaskLabel) => {
			const updatedLabelsByTaskId = new Map<Id<"tasks">, TaskLabel[]>();

			for (const taskId of typedTaskIds) {
				const task = tasks.find((t) => t.id === taskId);
				if (!task) continue;

				const hasLabel = task.labels.some((l) => l.id === label.id);
				const newLabels = hasLabel
					? task.labels.filter((l) => l.id !== label.id)
					: [...task.labels, label];

				updatedLabelsByTaskId.set(taskId, newLabels);
			}

			const uniqueLabelSets = new Map<string, TaskLabel[]>();
			for (const [, taskLabels] of updatedLabelsByTaskId.entries()) {
				const key = taskLabels
					.map((l) => `${l.id}:${l.name}:${l.color}`)
					.sort()
					.join("|");
				if (!uniqueLabelSets.has(key)) {
					uniqueLabelSets.set(key, taskLabels);
				}
			}

			const bulkPromises: Promise<null>[] = [];
			for (const [key, labelSet] of uniqueLabelSets.entries()) {
				const taskIdsForSet = [...updatedLabelsByTaskId.entries()]
					.filter(([_, labelsForTask]) => {
						const k = labelsForTask
							.map((l) => `${l.id}:${l.name}:${l.color}`)
							.sort()
							.join("|");
						return k === key;
					})
					.map(([taskId]) => taskId);
				if (taskIdsForSet.length === 0) continue;
				bulkPromises.push(bulkUpdateTasks(taskIdsForSet, { labels: labelSet }));
			}

			void Promise.all(bulkPromises)
				.then(() => {
					onClearSelection();
				})
				.catch(onMutationError);
		},
		[selectedTaskIds, tasks, bulkUpdateTasks, onClearSelection],
	);

	const handleArchive = useCallback(() => {
		setIsArchiving(true);
		void archiveTasks(typedTaskIds)
			.then(() => {
				onClearSelection();
			})
			.catch(onMutationError)
			.finally(() => {
				setIsArchiving(false);
			});
	}, [typedTaskIds, archiveTasks, onClearSelection]);

	const handleDelete = useCallback(() => {
		setIsDeleting(true);
		void deleteTasks(typedTaskIds)
			.then(() => {
				onClearSelection();
			})
			.catch(onMutationError)
			.finally(() => {
				setIsDeleting(false);
			});
	}, [typedTaskIds, deleteTasks, onClearSelection]);

	if (selectedCount === 0) return null;

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-t">
			<div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3 max-w-full">
				<div className="flex items-center gap-2 sm:gap-3 shrink-0">
					<span className="text-sm font-medium text-foreground">
						{selectedCount}{" "}
						<span className="hidden sm:inline">
							{selectedCount === 1 ? "task" : "tasks"} selected
						</span>
					</span>
					{!allSelected ? (
						<button
							type="button"
							onClick={onSelectAll}
							className="text-xs sm:text-sm text-primary hover:underline hidden xs:inline"
						>
							Select all {totalTasks}
						</button>
					) : null}
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

				<div className="sm:hidden flex items-center gap-1">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-8 gap-1 px-2">
								<span>Actions</span>
								<ChevronDown className="size-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-56">
							<DropdownMenuItem
								className="font-medium text-muted-foreground"
								disabled
							>
								Set Status
							</DropdownMenuItem>
							{TASK_STATUSES.map((status: TaskStatus) => {
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

							<DropdownMenuItem
								className="font-medium text-muted-foreground"
								disabled
							>
								Set Priority
							</DropdownMenuItem>
							{TASK_PRIORITIES.map((priority) => (
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
									{user.avatarUrl ? (
										<UserAvatar
											name={user.name}
											avatarUrl={user.avatarUrl}
											size="sm"
											className="mr-2"
										/>
									) : null}
									{user.name}
								</DropdownMenuItem>
							))}

							<DropdownMenuSeparator />

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

				<div className="hidden sm:flex items-center gap-1 overflow-x-auto">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
								<CheckSquare className="size-4" />
								<span className="hidden sm:inline">Status</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							{TASK_STATUSES.map((status: TaskStatus) => {
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

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
								<ArrowRight className="size-4" />
								<span className="hidden sm:inline">Priority</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							{TASK_PRIORITIES.map((priority) => (
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
									<UserAvatar
										name={user.name}
										avatarUrl={user.avatarUrl}
										size="sm"
										className="mr-2"
									/>
									{user.name}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

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
								disabled={isDeleting}
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
