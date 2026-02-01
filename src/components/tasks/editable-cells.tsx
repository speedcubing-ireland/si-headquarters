import { CheckIcon, CircleDashed, Tag } from "lucide-react";
import React from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
import { useDataV2 } from "@/data/data-store-v2";
import type {
	TaskLabel,
	TaskPriority,
	TaskStatus,
	Team,
	User,
} from "@/data/types-new";
import { formatDate } from "@/lib/format-utils";
import { statusColors, statusLabels } from "@/lib/task-constants";
import {
	getTaskFilterOptions,
	type TaskFilterOption,
	taskFilterConfigs,
} from "@/lib/task-filter-config";
import { getPriorityIcon, getStatusIcon } from "@/lib/task-utils";

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
	const config = taskFilterConfigs[type];

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
						<CommandEmpty>{config.emptyMessage}</CommandEmpty>
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

export function EditableTaskStatus({
	status,
	taskId,
	children,
}: {
	status: TaskStatus;
	taskId: string;
	children?: React.ReactNode;
}) {
	const updateTaskStatus = useDataV2((state) => state.updateTaskStatus);
	const getTaskById = useDataV2((state) => state.getTaskById);
	const isTaskFullyApproved = useDataV2((state) => state.isTaskFullyApproved);
	const users = useDataV2((state) => state.users);
	const currentUser = users[0];
	const StatusIcon = getStatusIcon(status);
	const options = getTaskFilterOptions(
		"status",
	) as TaskFilterOption<TaskStatus>[];
	const [showApprovalWarning, setShowApprovalWarning] = React.useState(false);
	const [pendingStatus, setPendingStatus] = React.useState<TaskStatus | null>(
		null,
	);

	const handleStatusChange = (newStatus: TaskStatus) => {
		const task = getTaskById(taskId);
		if (!task) return;

		// Check if trying to mark as done without approvals
		if (
			newStatus === "done" &&
			task.requiredApprovalBy.length > 0 &&
			!isTaskFullyApproved(taskId)
		) {
			setPendingStatus(newStatus);
			setShowApprovalWarning(true);
			return;
		}

		updateTaskStatus(taskId, newStatus, currentUser);
	};

	const confirmStatusChange = () => {
		if (pendingStatus) {
			updateTaskStatus(taskId, pendingStatus, currentUser);
			setPendingStatus(null);
		}
		setShowApprovalWarning(false);
	};

	const cancelStatusChange = () => {
		setPendingStatus(null);
		setShowApprovalWarning(false);
	};

	return (
		<>
			<EditableTaskCell
				type="status"
				value={status}
				options={options}
				onChange={handleStatusChange}
				triggerClassName={
					children ? "h-6 w-6 p-0 justify-center hover:bg-muted/50" : undefined
				}
				renderTrigger={(value) =>
					children ?? (
						<Badge className={statusColors[value]}>
							<StatusIcon className="size-3 mr-1" />
							{statusLabels[value]}
						</Badge>
					)
				}
				renderOption={(option) => {
					const Icon = option.icon;
					return (
						<div className="flex items-center gap-2">
							{Icon && <Icon className="size-4 text-muted-foreground" />}
							<span className="text-xs">{option.label}</span>
						</div>
					);
				}}
			/>
			{showApprovalWarning && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div className="bg-background rounded-lg p-6 max-w-sm mx-4 shadow-lg">
						<h3 className="text-lg font-semibold mb-2">Missing Approvals</h3>
						<p className="text-sm text-muted-foreground mb-4">
							This task requires approvals before it can be marked as done. Are
							you sure you want to proceed?
						</p>
						<div className="flex gap-2 justify-end">
							<button
								type="button"
								onClick={cancelStatusChange}
								className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={confirmStatusChange}
								className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
							>
								Proceed Anyway
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

export function EditableTaskPriority({
	priority,
	taskId,
}: {
	priority: TaskPriority;
	taskId: string;
}) {
	const updateTaskPriority = useDataV2((state) => state.updateTaskPriority);
	const options = getTaskFilterOptions(
		"priority",
	) as TaskFilterOption<TaskPriority>[];

	return (
		<EditableTaskCell
			type="priority"
			value={priority}
			options={options}
			onChange={(newPriority) => updateTaskPriority(taskId, newPriority)}
			triggerClassName="h-6 w-6 p-0 justify-center hover:bg-muted/50"
			renderTrigger={(value) => {
				const TriggerIcon = getPriorityIcon(value);
				return <TriggerIcon className="size-4 text-muted-foreground" />;
			}}
			renderOption={(option) => {
				const OptionIcon = option.icon;
				return (
					<div className="flex items-center gap-2">
						{OptionIcon && (
							<OptionIcon className="size-4 text-muted-foreground" />
						)}
						<span className="text-xs">{option.label}</span>
					</div>
				);
			}}
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
	const users = useDataV2((state) => state.users);
	const updateTaskAssignee = useDataV2((state) => state.updateTaskAssignee);
	const [open, setOpen] = React.useState(false);

	const handleChange = (userId: string) => {
		const selectedUser = users.find((u) => u.id === userId) || null;
		updateTaskAssignee(taskId, selectedUser);
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
								<UserAvatar user={assignee} size="sm" />
							</>
						) : (
							<UserAvatar
								user={assignee}
								size="sm"
								showName
								nameClassName="text-xs truncate max-w-[80px]"
							/>
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
									updateTaskAssignee(taskId, null);
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
									<UserAvatar
										user={user}
										size="xs"
										showName
										nameClassName="text-xs"
									/>
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
	const allLabels = useDataV2((state) => state.labels);
	const updateTaskLabels = useDataV2((state) => state.updateTaskLabels);
	const [open, setOpen] = React.useState(false);
	const hiddenLabels = labels.slice(2);

	const toggleLabel = (labelId: string) => {
		const hasLabel = labels.some((l) => l.id === labelId);
		if (hasLabel) {
			updateTaskLabels(
				taskId,
				labels.filter((l) => l.id !== labelId),
			);
		} else {
			const label = allLabels.find((l) => l.id === labelId);
			if (label) {
				updateTaskLabels(taskId, [...labels, label]);
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

export function TaskDateDisplay({ date }: { date?: string | null }) {
	if (!date) {
		return <span className="text-muted-foreground text-xs">No date</span>;
	}

	const formatted = formatDate(date);
	return formatted ? (
		<span className="text-xs">{formatted}</span>
	) : (
		<span className="text-muted-foreground text-xs">Invalid date</span>
	);
}

export function EditableTaskOwner({
	owner,
	taskId,
}: {
	owner: Team | User | null;
	taskId: string;
}) {
	const teams = useDataV2((state) => state.teams);
	const users = useDataV2((state) => state.users);
	const updateTaskOwner = useDataV2((state) => state.updateTaskOwner);
	const [open, setOpen] = React.useState(false);

	const currentValue = owner
		? "members" in owner
			? `team:${owner.id}`
			: `user:${owner.id}`
		: "unassigned";

	const handleChange = (value: string) => {
		if (value === "unassigned") {
			updateTaskOwner(taskId, null);
			setOpen(false);
			return;
		}

		if (value.startsWith("team:")) {
			const id = value.slice("team:".length);
			const team = teams.find((t) => t.id === id) ?? null;
			updateTaskOwner(taskId, team);
			setOpen(false);
			return;
		}

		if (value.startsWith("user:")) {
			const id = value.slice("user:".length);
			const user = users.find((u) => u.id === id) ?? null;
			updateTaskOwner(taskId, user);
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
			return <UserAvatar user={owner} size="sm" />;
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
											<UserAvatar
												user={user}
												size="xs"
												showName
												nameClassName="text-xs"
											/>
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
