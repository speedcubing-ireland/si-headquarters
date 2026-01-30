"use client";

import * as React from "react";
import { Check, Plus, X } from "lucide-react";

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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { User as UserType } from "@/data/types-new";
import { getInitials } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

interface MultiUserPickerProps {
	values: UserType[];
	onChange: (values: UserType[]) => void;
	users: UserType[];
	trigger: React.ReactNode;
	emptyText?: string;
	searchPlaceholder?: string;
	className?: string;
	align?: "start" | "center" | "end";
	maxDisplay?: number;
}

export function MultiUserPicker({
	values,
	onChange,
	users,
	trigger,
	emptyText = "No users found.",
	searchPlaceholder = "Search users...",
	className,
	align = "end",
	maxDisplay = 3,
}: MultiUserPickerProps) {
	const [open, setOpen] = React.useState(false);

	const toggleUser = (user: UserType) => {
		const isSelected = values.some((u) => u.id === user.id);
		if (isSelected) {
			onChange(values.filter((u) => u.id !== user.id));
		} else {
			onChange([...values, user]);
		}
	};

	const removeUser = (userId: string) => {
		onChange(values.filter((u) => u.id !== userId));
	};

	const displayUsers = values.slice(0, maxDisplay);
	const remainingCount = values.length - maxDisplay;

	return (
		<div className="flex flex-col gap-2">
			{/* Display selected users */}
			{values.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{displayUsers.map((user) => (
						<Badge
							key={user.id}
							variant="secondary"
							className="h-6 px-1.5 gap-1.5 text-xs font-normal"
						>
							<Avatar className="size-4">
								<AvatarImage src={user.avatarUrl} />
								<AvatarFallback className="text-[8px]">
									{getInitials(user.name)}
								</AvatarFallback>
							</Avatar>
							<span className="truncate max-w-[100px]">{user.name}</span>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									removeUser(user.id);
								}}
								className="ml-0.5 hover:text-destructive"
							>
								<X className="size-3" />
							</button>
						</Badge>
					))}
					{remainingCount > 0 && (
						<Badge variant="outline" className="h-6 px-2 text-xs">
							+{remainingCount}
						</Badge>
					)}
				</div>
			)}

			{/* Add button / trigger */}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					{trigger || (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
						>
							<Plus className="size-3.5 mr-1" />
							Add
						</Button>
					)}
				</PopoverTrigger>
				<PopoverContent
					className={cn("p-0 w-[260px]", className)}
					align={align}
				>
					<Command>
						<CommandInput placeholder={searchPlaceholder} />
						<CommandList className="max-h-[300px]">
							<CommandEmpty>{emptyText}</CommandEmpty>
							<CommandGroup heading="Select users">
								{users.map((user) => {
									const isSelected = values.some((u) => u.id === user.id);
									return (
										<CommandItem
											key={user.id}
											value={user.id}
											onSelect={() => toggleUser(user)}
										>
											<div className="flex items-center gap-2 flex-1">
												<Avatar className="size-6">
													<AvatarImage src={user.avatarUrl} />
													<AvatarFallback className="text-[10px]">
														{getInitials(user.name)}
													</AvatarFallback>
												</Avatar>
												<span className="text-sm">{user.name}</span>
											</div>
											{isSelected && <Check className="size-4 text-primary" />}
										</CommandItem>
									);
								})}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}
