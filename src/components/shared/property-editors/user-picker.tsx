"use client";

import * as React from "react";
import { Check, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import type { Team, User as UserType } from "@/data/types-new";
import { getInitials } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

type UserOrTeam = UserType | Team;

interface UserPickerProps {
	value: UserOrTeam | null;
	onChange: (value: UserOrTeam | null) => void;
	users: UserType[];
	teams?: Team[];
	trigger: React.ReactNode;
	emptyText?: string;
	allowUnassigned?: boolean;
	className?: string;
	align?: "start" | "center" | "end";
}

export function UserPicker({
	value,
	onChange,
	users,
	teams = [],
	trigger,
	emptyText = "No users found.",
	allowUnassigned = true,
	className,
	align = "end",
}: UserPickerProps) {
	const [open, setOpen] = React.useState(false);

	const isTeam = (entity: UserOrTeam): entity is Team => "members" in entity;

	const isSelected = (entity: UserOrTeam) => {
		if (!value) return false;
		return entity.id === value.id && isTeam(entity) === isTeam(value);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent className={cn("p-0 w-[260px]", className)} align={align}>
				<Command>
					<CommandInput placeholder="Search users..." />
					<CommandList className="max-h-[300px]">
						<CommandEmpty>{emptyText}</CommandEmpty>

						{allowUnassigned && (
							<CommandGroup>
								<CommandItem
									value="unassigned"
									onSelect={() => {
										onChange(null);
										setOpen(false);
									}}
								>
									<div className="flex items-center gap-2 flex-1">
										<div className="size-6 rounded-full bg-muted flex items-center justify-center">
											<User className="size-3.5 text-muted-foreground" />
										</div>
										<span className="text-sm text-muted-foreground">
											Unassigned
										</span>
									</div>
									{!value && <Check className="size-4 text-primary" />}
								</CommandItem>
							</CommandGroup>
						)}

						{teams.length > 0 && (
							<CommandGroup heading="Teams">
								{teams.map((team) => (
									<CommandItem
										key={team.id}
										value={`team:${team.id}`}
										onSelect={() => {
											onChange(team);
											setOpen(false);
										}}
									>
										<div className="flex items-center gap-2 flex-1">
											<div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
												T
											</div>
											<span className="text-sm">{team.name}</span>
										</div>
										{isSelected(team) && (
											<Check className="size-4 text-primary" />
										)}
									</CommandItem>
								))}
							</CommandGroup>
						)}

						{users.length > 0 && (
							<CommandGroup heading="Individuals">
								{users.map((user) => (
									<CommandItem
										key={user.id}
										value={`user:${user.id}`}
										onSelect={() => {
											onChange(user);
											setOpen(false);
										}}
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
										{isSelected(user) && (
											<Check className="size-4 text-primary" />
										)}
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
