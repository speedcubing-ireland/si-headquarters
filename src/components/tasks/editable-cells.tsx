import { CheckIcon } from "lucide-react";
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useDataV2 } from "@/data/data-store-v2";
import type {
	TaskLabel,
	TaskPriority,
	TaskStatus,
	User,
} from "@/data/types-new";
import { statusColors, statusLabels } from "@/lib/task-constants";
import {
	getTaskFilterOptions,
	type TaskFilterOption,
	taskFilterConfigs,
} from "@/lib/task-filter-config";
import {
	formatDate,
	getInitials,
	getPriorityIcon,
	getStatusIcon,
} from "@/lib/task-utils";

interface EditableTaskCellProps<T extends TaskStatus | TaskPriority | string> {
	type: "status" | "priority" | "assignee" | "labels";
	value: T;
	onChange: (newValue: T) => void;
	renderTrigger: (value: T) => React.ReactNode;
	renderOption: (option: TaskFilterOption<T>) => React.ReactNode;
	isSelected?: (optionValue: T, currentValue: T) => boolean;
	options: TaskFilterOption<T>[];
}

function EditableTaskCell<T extends TaskStatus | TaskPriority | string>({
	type,
	value,
	onChange,
	renderTrigger,
	renderOption,
	isSelected,
	options,
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
				<Button variant="ghost" size="sm" className="h-7 px-2 justify-start">
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
}: {
	status: TaskStatus;
	taskId: string;
}) {
	const updateTaskStatus = useDataV2((state) => state.updateTaskStatus);
	const StatusIcon = getStatusIcon(status);
	const options = getTaskFilterOptions(
		"status",
	) as TaskFilterOption<TaskStatus>[];

	return (
		<EditableTaskCell
			type="status"
			value={status}
			options={options}
			onChange={(newStatus) => updateTaskStatus(taskId, newStatus)}
			renderTrigger={(value) => (
				<Badge className={statusColors[value]}>
					<StatusIcon className="size-3 mr-1" />
					{statusLabels[value]}
				</Badge>
			)}
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
	const Icon = getPriorityIcon(priority);
	const options = getTaskFilterOptions(
		"priority",
	) as TaskFilterOption<TaskPriority>[];

	return (
		<EditableTaskCell
			type="priority"
			value={priority}
			options={options}
			onChange={(newPriority) => updateTaskPriority(taskId, newPriority)}
			renderTrigger={() => <Icon className="size-4 text-muted-foreground" />}
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
}: {
	assignee: User | null;
	taskId: string;
}) {
	const users = useDataV2((state) => state.users);
	const updateTaskAssignee = useDataV2((state) => state.updateTaskAssignee);
	const [open, setOpen] = React.useState(false);

	const handleChange = (userId: string) => {
		const selectedUser = users.find((u) => u.id === userId) || null;
		updateTaskAssignee(taskId, selectedUser);
		setOpen(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className="h-7 px-2 justify-start">
					{assignee ? (
						<div className="flex items-center gap-1.5">
							<Avatar className="size-5">
								<AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
								<AvatarFallback className="text-[10px]">
									{getInitials(assignee.name)}
								</AvatarFallback>
							</Avatar>
							<span className="text-xs truncate max-w-[80px]">
								{assignee.name}
							</span>
						</div>
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
									<div className="flex items-center gap-2">
										<Avatar className="size-4">
											<AvatarImage src={user.avatarUrl} alt={user.name} />
											<AvatarFallback className="text-[10px]">
												{getInitials(user.name)}
											</AvatarFallback>
										</Avatar>
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
}: {
	labels: TaskLabel[];
	taskId: string;
}) {
	const allLabels = useDataV2((state) => state.labels);
	const updateTaskLabels = useDataV2((state) => state.updateTaskLabels);
	const [open, setOpen] = React.useState(false);

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
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className="h-7 px-2 justify-start">
					{labels.length > 0 ? (
						<div className="flex items-center gap-1 flex-wrap">
							{labels.slice(0, 2).map((label) => (
								<Badge
									key={label.id}
									className="text-[10px] px-1.5 py-0"
									style={{ backgroundColor: label.color, color: "#fff" }}
								>
									{label.name}
								</Badge>
							))}
							{labels.length > 2 && (
								<span className="text-xs text-muted-foreground">
									+{labels.length - 2}
								</span>
							)}
						</div>
					) : (
						<span className="text-xs text-muted-foreground">No labels</span>
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
