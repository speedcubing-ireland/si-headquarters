import React from "react";
import { CheckIcon } from "lucide-react";
import { LeadsDisplay } from "@/components/competitions/leads-display";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
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
import { useData } from "@/data/data-store";
import type { Priority, Status, User } from "@/data/types";
import { formatDate, getInitials, getPriorityIcon } from "@/lib/competitions-utils";
import {
	type FilterOption,
	type FilterType,
	filterConfigs,
	getFilterOptions,
} from "@/lib/filter-config";
import { getStatusClass, getStatusLabel } from "@/lib/status-config";

interface EditableCellProps<T extends Status | Priority | string> {
	type: FilterType;
	value: T;
	onChange: (newValue: T) => void;
	renderTrigger: (value: T) => React.ReactNode;
	renderOption: (option: FilterOption<T>) => React.ReactNode;
	isSelected?: (optionValue: T, currentValue: T) => boolean;
}

function EditableCell<T extends Status | Priority | string>({
	type,
	value,
	onChange,
	renderTrigger,
	renderOption,
	isSelected,
}: EditableCellProps<T>) {
	const [open, setOpen] = React.useState(false);
	const config = filterConfigs[type];
	const options = getFilterOptions(type) as FilterOption<T>[];

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
					<CommandInput placeholder={config.placeholder} />
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
										{renderOption(option)}
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

// Priority-specific component
export function EditablePriority({
	priority,
	projectId,
}: {
	priority: Priority;
	projectId: string;
}) {
	const updatePriority = useData((state) => state.updateCompetitionPriority);
	const Icon = getPriorityIcon(priority);

	return (
		<EditableCell
			type="priority"
			value={priority}
			onChange={(newPriority) => updatePriority(projectId, newPriority)}
			renderTrigger={() => <Icon className="size-4 text-muted-foreground" />}
			renderOption={(option) => {
				const OptionIcon = option.icon;
				return (
					<div className="flex items-center gap-2">
						{OptionIcon ? (
							<OptionIcon className="size-4 text-muted-foreground" />
						) : (
							<span className="size-4" />
						)}
						<span className="text-xs">{option.label}</span>
					</div>
				);
			}}
		/>
	);
}

// Status-specific component
export function EditableStatus({
	status,
	projectId,
}: {
	status: Status;
	projectId: string;
}) {
	const updateStatus = useData((state) => state.updateCompetitionStatus);

	return (
		<EditableCell
			type="status"
			value={status}
			onChange={(newStatus) => updateStatus(projectId, newStatus)}
			renderTrigger={(value) => (
				<Badge className={getStatusClass(value)}>{getStatusLabel(value)}</Badge>
			)}
			renderOption={(option) => (
				<Badge className={getStatusClass(option.value)}>{option.label}</Badge>
			)}
		/>
	);
}

// Lead-specific component (needs special handling for multiple leads)
export function EditableLead({
	leads,
	projectId,
}: {
	leads: User[];
	projectId: string;
}) {
	const users = useData((state) => state.users);
	const updateLeads = useData((state) => state.updateCompetitionLeads);

	const handleChange = (userName: string) => {
		const selectedUser = users.find((u) => u.name === userName);
		if (selectedUser) {
			updateLeads(projectId, [selectedUser]);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className="h-7 px-2 justify-start">
					<LeadsDisplay leads={leads} variant="detailed" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-48 p-0" align="start">
				<Command>
					<CommandInput placeholder="Set lead..." />
					<CommandList>
						<CommandEmpty>No user found.</CommandEmpty>
						<CommandGroup>
							{users.map((user) => (
								<CommandItem
									key={user.name}
									value={user.name}
									onSelect={() => handleChange(user.name)}
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
									{leads.some((l) => l.name === user.name) && (
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

export function DateDisplay({ date }: { date?: string }) {
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
