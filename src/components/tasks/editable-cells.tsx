import { CheckIcon, CircleDashed, Tag } from "lucide-react";
import React from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	useTask,
	useUsers,
	useTeams,
	useLabels,
	useTaskMutations,
} from "@/hooks/use-convex-data";
import type {
	TaskLabel,
	TaskPriority,
	TaskStatus,
	Team,
	User,
} from "@/data/types-new";

import { statusLabels } from "@/lib/task-constants";
import {
	getFilterValues,
	getFilterConfig,
	type FilterContext,
} from "@/lib/task-filter-definitions";
import { getPriorityIcon, getStatusIcon } from "@/lib/task-utils";

// Compatibility type matching old TaskFilterOption structure
interface TaskFilterOption<T = string> {
	value: T;
	label: string;
	icon: React.ElementType | null;
	avatarUrl?: string;
	color?: string;
}

interface EditableTaskCellProps<T extends TaskStatus | TaskPriority | string> {
	type: "status" | "priority" | "assignee" | "labels";
	value: T;
	onChange: (newValue: T) => void;
	renderTrigger: (value: T) => React.ReactNode;
	renderOption: (option: TaskFilterOption<T>) => React.ReactNode;
	isSelected?: (optionValue: T, currentValue: T) => boolean;
	options: TaskFilterOption<T>[];
	triggerClassName?: string;
}

function EditableTaskCell<T extends TaskStatus | TaskPriority | string>({
	type,
	value,
	onChange,
	renderTrigger,
	renderOption,
	isSelected,
	options,
	triggerClassName,
}: EditableTaskCellProps<T>) {
	const [open, setOpen] = React.useState(false);
	const config = getFilterConfig(type);

	const handleChange = (newValue: string) => {
		onChange(newValue as T);
		setOpen(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={
						triggerClassName ?? "h-6 px-1 justify-start hover:bg-muted/50"
					}
				>
					{renderTrigger(value)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-48 p-0" align="start">
				<Command>
					<CommandInput placeholder="Search" />
					<CommandList>
						<CommandEmpty>{`No ${config?.displayName.toLowerCase() ?? "items"} found.`}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => {
								const optionValue = option.value as T;
								const selected = isSelected
									? isSelected(optionValue, value)
									: optionValue === value;
								return (
									<CommandItem
										key={String(option.value)}
										value={String(option.value)}
										onSelect={() => handleChange(String(option.value))}
										className="flex items-center justify-between"
									>
										{renderOption(option as TaskFilterOption<T>)}
										{selected && <CheckIcon size={14} className="ml-auto" />}
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// Helper to convert new filter values to old format
function mapToOldFormat(
	values: ReturnType<typeof getFilterValues>,
): TaskFilterOption[] {
	return values.map((val) => ({
		value: val.value,
		label: val.label,
		icon: val.iconType === "icon" ? val.icon : null,
		avatarUrl: val.iconType === "avatar" ? val.avatarUrl : undefined,
		color: undefined,
	}));
}

export function EditableTaskStatus({
	status,
	taskId,
	children,
}: {
	status: TaskStatus;
	taskId: string;
	children?: React.ReactNode;
}) {
	const { updateTask } = useTaskMutations();
	const task = useTask(taskId);
	const { users } = useUsers();
	const StatusIcon = getStatusIcon(status);
	const filterContext: FilterContext = { users, labels: [], teams: [] };
	const options = mapToOldFormat(
		getFilterValues("status", filterContext),
	) as TaskFilterOption<TaskStatus>[];

	// Check if task is fully approved (handles teams correctly)
	const isTaskFullyApproved = (() => {
		if (!task || task.requiredApprovalBy.length === 0) return true;
		const approvedUserIds = new Set(task.approvedBy.map((a) => a.id));
		return task.requiredApprovalBy.every((approver) => {
			if ("members" in approver) {
				// Team: check if any member has approved
				return approver.members.some((m) => approvedUserIds.has(m.id));
			}
			// User: check if this user has approved
			return approvedUserIds.has(approver.id);
		});
	})();

	const hasRequiredApprovals = task?.requiredApprovalBy.length > 0;

	const handleStatusChange = (newStatus: TaskStatus) => {
		if (!task) return;

		if (newStatus === "done" && hasRequiredApprovals && !isTaskFullyApproved) {
			return;
		}

		void updateTask(taskId, { status: newStatus });
	};

	return (
		<EditableTaskCell
			type="status"
			value={status}
			onChange={handleStatusChange}
			renderTrigger={(value) =>
				children ?? (
					<div className="flex items-center gap-1.5">
						<StatusIcon className="size-4" />
						<span className="text-xs">{statusLabels[value]}</span>
					</div>
				)
			}
			renderOption={(option) => {
				const OptionIcon = option.icon ?? CircleDashed;
				return (
					<div className="flex items-center gap-2">
						<OptionIcon className="size-4 text-muted-foreground" />
						<span className="text-xs">{option.label}</span>
					</div>
				);
			}}
			options={options.filter(
				(option) =>
					!(
						option.value === "done" &&
						hasRequiredApprovals &&
						!isTaskFullyApproved
					),
			)}
		/>
	);
}

export function EditableTaskPriority({
	priority,
	taskId,
	children,
}: {
	priority: TaskPriority;
	taskId: string;
	children?: React.ReactNode;
}) {
	const { updateTask } = useTaskMutations();
	const { users } = useUsers();
	const PriorityIcon = getPriorityIcon(priority);
	const filterContext: FilterContext = { users, labels: [], teams: [] };
	const options = mapToOldFormat(
		getFilterValues("priority", filterContext),
	) as TaskFilterOption<TaskPriority>[];

	return (
		<EditableTaskCell
			type="priority"
			value={priority}
			onChange={(newPriority) =>
				void updateTask(taskId, { priority: newPriority })
			}
			renderTrigger={(value) =>
				children ?? (
					<div className="flex items-center gap-1.5">
						<PriorityIcon className="size-4" />
						<span className="text-xs capitalize">{value}</span>
					</div>
				)
			}
			renderOption={(option) => {
				const OptionIcon = option.icon ?? (() => null);
				return (
					<div className="flex items-center gap-2">
						<OptionIcon className="size-4 text-muted-foreground" />
						<span className="text-xs">{option.label}</span>
					</div>
				);
			}}
			options={options}
		/>
	);
}

export function EditableTaskAssignee({
	assignee,
	taskId,
	variant = "default",
}: {
	assignee: User | null;
	taskId: string;
	variant?: "default" | "icon";
}) {
	const { users } = useUsers();
	const { updateTask } = useTaskMutations();
	const [open, setOpen] = React.useState(false);

	const handleChange = (userId: string) => {
		const selectedUser = users.find((u) => u.id === userId) || null;
		void updateTask(taskId, { assignee: selectedUser });
		setOpen(false);
	};

	const isIconVariant = variant === "icon";

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={
						isIconVariant
							? "h-6 w-6 p-0 justify-center hover:bg-muted/50"
							: "h-7 px-2 justify-start"
					}
				>
					{assignee ? (
						isIconVariant ? (
							<>
								<span className="sr-only">Assigned to {assignee.name}</span>
								<UserAvatar
									name={assignee.name}
									avatarUrl={assignee.avatarUrl}
									size="sm"
								/>
							</>
						) : (
							<div className="flex items-center gap-1.5">
								<UserAvatar
									name={assignee.name}
									avatarUrl={assignee.avatarUrl}
									size="sm"
								/>
								<span className="text-xs truncate max-w-[80px]">
									{assignee.name}
								</span>
							</div>
						)
					) : isIconVariant ? (
						<>
							<span className="sr-only">Unassigned</span>
							<CircleDashed className="size-4 text-muted-foreground/60" />
						</>
					) : (
						<span className="text-xs text-muted-foreground">Unassigned</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-48 p-0" align="start">
				<Command>
					<CommandInput placeholder="Set assignee..." />
					<CommandList>
						<CommandEmpty>No user found.</CommandEmpty>
						<CommandGroup>
							<CommandItem
								value="unassigned"
								onSelect={() => {
									void updateTask(taskId, { assignee: null });
									setOpen(false);
								}}
								className="flex items-center justify-between"
							>
								<span className="text-xs text-muted-foreground">
									Unassigned
								</span>
								{!assignee && <CheckIcon size={14} className="ml-auto" />}
							</CommandItem>
							{users.map((user) => (
								<CommandItem
									key={user.id}
									value={user.name}
									onSelect={() => handleChange(user.id)}
									className="flex items-center justify-between"
								>
									<div className="flex items-center gap-2">
										<UserAvatar
											name={user.name}
											avatarUrl={user.avatarUrl}
											size="sm"
										/>
										<span className="text-xs">{user.name}</span>
									</div>
									{assignee?.id === user.id && (
										<CheckIcon size={14} className="ml-auto" />
									)}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function EditableTaskLabels({
	labels,
	taskId,
	wrap = false,
}: {
	labels: TaskLabel[];
	taskId: string;
	wrap?: boolean;
}) {
	const { labels: allLabels } = useLabels();
	const { updateTask } = useTaskMutations();
	const [open, setOpen] = React.useState(false);
	const hiddenLabels = labels.slice(2);

	const toggleLabel = (labelId: string) => {
		const hasLabel = labels.some((l) => l.id === labelId);
		if (hasLabel) {
			void updateTask(taskId, {
				labels: labels.filter((l) => l.id !== labelId),
			});
		} else {
			const label = allLabels.find((l) => l.id === labelId);
			if (label) {
				void updateTask(taskId, { labels: [...labels, label] });
			}
		}
		setOpen(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 px-2 justify-end gap-1 min-w-[40px]"
				>
					{labels.length > 0 ? (
						<div
							className={cn(
								"flex items-center gap-1.5 justify-end",
								wrap ? "flex-wrap" : "flex-nowrap overflow-hidden",
							)}
						>
							{labels.slice(0, wrap ? labels.length : 2).map((label) => (
								<span
									key={label.id}
									className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
								>
									<span
										className="size-2 rounded-full shrink-0"
										style={{ backgroundColor: label.color }}
									/>
									<span className="truncate max-w-[80px]">{label.name}</span>
								</span>
							))}
							{!wrap && labels.length >= 3 && (
								<Tooltip>
									<TooltipTrigger asChild>
										<span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
											<span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" />
											<span className="whitespace-nowrap">
												+{labels.length - 2}{" "}
												{labels.length - 2 === 1 ? "label" : "labels"}
											</span>
										</span>
									</TooltipTrigger>
									<TooltipContent side="top" sideOffset={6}>
										<div className="max-w-[240px]">
											{hiddenLabels.map((l) => l.name).join(", ")}
										</div>
									</TooltipContent>
								</Tooltip>
							)}
						</div>
					) : (
						<span className="text-xs text-muted-foreground flex items-center gap-1">
							<Tag className="size-3" />
							Add labels
						</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-48 p-0" align="start">
				<Command>
					<CommandInput placeholder="Search labels..." />
					<CommandList>
						<CommandEmpty>No labels found.</CommandEmpty>
						<CommandGroup>
							{allLabels.map((label) => {
								const isSelected = labels.some((l) => l.id === label.id);
								return (
									<CommandItem
										key={label.id}
										value={label.name}
										onSelect={() => toggleLabel(label.id)}
										className="flex items-center justify-between"
									>
										<div className="flex items-center gap-2">
											<div
												className="size-3 rounded-full"
												style={{ backgroundColor: label.color }}
											/>
											<span className="text-xs">{label.name}</span>
										</div>
										{isSelected && <CheckIcon size={14} className="ml-auto" />}
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function EditableTaskOwner({
	owner,
	taskId,
}: {
	owner: Team | User | null;
	taskId: string;
}) {
	const { teams } = useTeams();
	const { users } = useUsers();
	const { updateTask } = useTaskMutations();
	const [open, setOpen] = React.useState(false);

	const currentValue = owner
		? "members" in owner
			? `team:${owner.id}`
			: `user:${owner.id}`
		: "unassigned";

	const handleChange = (value: string) => {
		if (value === "unassigned") {
			void updateTask(taskId, { owner: null });
			setOpen(false);
			return;
		}

		if (value.startsWith("team:")) {
			const id = value.slice("team:".length);
			const team = teams.find((t) => t.id === id) ?? null;
			void updateTask(taskId, { owner: team });
			setOpen(false);
			return;
		}

		if (value.startsWith("user:")) {
			const id = value.slice("user:".length);
			const user = users.find((u) => u.id === id) ?? null;
			void updateTask(taskId, { owner: user });
			setOpen(false);
		}
	};

	const renderTriggerContent = () => {
		if (owner && "members" in owner) {
			return (
				<div className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
					<span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[8px]">
						T
					</span>
					<span className="truncate max-w-[80px]">{owner.name}</span>
				</div>
			);
		}

		if (owner && "avatarUrl" in owner) {
			return (
				<UserAvatar name={owner.name} avatarUrl={owner.avatarUrl} size="sm" />
			);
		}

		// Blank team chip when no owner
		return (
			<span className="inline-flex size-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40" />
		);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-6 px-1 justify-center hover:bg-muted/50"
				>
					{renderTriggerContent()}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56 p-0" align="start">
				<Command>
					<CommandInput placeholder="Set owner..." />
					<CommandList>
						<CommandEmpty>No match found.</CommandEmpty>
						<CommandGroup>
							<CommandItem
								value="unassigned"
								onSelect={() => handleChange("unassigned")}
								className="flex items-center justify-between"
							>
								<span className="text-xs text-muted-foreground">
									Owner: Unassigned
								</span>
								{currentValue === "unassigned" && (
									<CheckIcon size={14} className="ml-auto" />
								)}
							</CommandItem>
						</CommandGroup>
						{teams.length > 0 && (
							<CommandGroup heading="Teams">
								{teams.map((team) => {
									const value = `team:${team.id}`;
									const selected = currentValue === value;
									return (
										<CommandItem
											key={team.id}
											value={team.name}
											onSelect={() => handleChange(value)}
											className="flex items-center justify-between"
										>
											<div className="flex items-center gap-2">
												<span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[8px]">
													T
												</span>
												<span className="text-xs">{team.name}</span>
											</div>
											{selected && <CheckIcon size={14} className="ml-auto" />}
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}
						{users.length > 0 && (
							<CommandGroup heading="Individuals">
								{users.map((user) => {
									const value = `user:${user.id}`;
									const selected = currentValue === value;
									return (
										<CommandItem
											key={user.id}
											value={user.name}
											onSelect={() => handleChange(value)}
											className="flex items-center justify-between"
										>
											<div className="flex items-center gap-2">
												<UserAvatar
													name={user.name}
													avatarUrl={user.avatarUrl}
													size="sm"
												/>
												<span className="text-xs">{user.name}</span>
											</div>
											{selected && <CheckIcon size={14} className="ml-auto" />}
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
