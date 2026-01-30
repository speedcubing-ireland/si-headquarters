import { CheckIcon } from "lucide-react";
import React from "react";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useDataV2 } from "@/data/data-store-v2";
import type { Competition, User } from "@/data/types-new";
import {
	COMPETITION_PHASE_KEYS,
	type CompetitionPhaseKey,
} from "@/data/types-new";
import {
	getCurrentPhaseKey,
	getPhaseClass,
	getPhaseLabel,
} from "@/lib/competition-phase-config";
import { getInitials } from "@/lib/format-utils";

interface EditableUserCellProps {
	emptyLabel: string;
	selectedUser: User | null;
	allUsers: User[];
	onChange: (user: User | null) => void;
}

function EditableUserCell({
	emptyLabel,
	selectedUser,
	allUsers,
	onChange,
}: EditableUserCellProps) {
	const [open, setOpen] = React.useState(false);

	const handleChange = (userId: string | null) => {
		const nextUser = userId
			? (allUsers.find((u) => u.id === userId) ?? null)
			: null;
		onChange(nextUser);
		setOpen(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className="h-7 px-2 justify-start">
					{selectedUser ? (
						<UserAvatar
							user={selectedUser}
							size="sm"
							showName
							nameClassName="text-xs truncate max-w-[100px]"
						/>
					) : (
						<span className="text-xs text-muted-foreground">{emptyLabel}</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56 p-0" align="start">
				<Command>
					<CommandInput placeholder="Search" />
					<CommandList>
						<CommandEmpty>No user found.</CommandEmpty>
						<CommandGroup>
							<CommandItem
								value="unassigned"
								onSelect={() => handleChange(null)}
								className="flex items-center justify-between"
							>
								<span className="text-xs text-muted-foreground">
									Unassigned
								</span>
								{!selectedUser && <CheckIcon size={14} className="ml-auto" />}
							</CommandItem>
							{allUsers.map((user) => (
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
									{selectedUser?.id === user.id && (
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

export function EditablePhaseCell({
	competition,
}: {
	competition: Competition;
}) {
	const updateCompetition = useDataV2((state) => state.updateCompetition);
	const [open, setOpen] = React.useState(false);

	const currentKey = getCurrentPhaseKey(competition);

	const handleChange = (key: CompetitionPhaseKey) => {
		// Try to find a matching phase by name for this competition
		const targetIndex =
			competition.phases.findIndex((phase) => {
				const phaseName = phase.name.toLowerCase();
				const derivedKey = (() => {
					if (phaseName.startsWith("concept")) return "concept";
					if (phaseName.startsWith("pre-announcement"))
						return "pre-announcement";
					if (phaseName.startsWith("post-announcement"))
						return "post-announcement";
					if (phaseName.startsWith("pre-competition")) return "pre-competition";
					if (phaseName.startsWith("post-competition"))
						return "post-competition";
					if (phaseName.startsWith("archive")) return "archive";
					return "concept";
				})();
				return derivedKey === key;
			}) ?? competition.currentPhaseIdx;

		const nextIndex =
			targetIndex >= 0 ? targetIndex : competition.currentPhaseIdx;

		updateCompetition(competition.id, { currentPhaseIdx: nextIndex });
		setOpen(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className="h-7 px-2 justify-start">
					<Badge className={getPhaseClass(currentKey)}>
						{getPhaseLabel(currentKey)}
					</Badge>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56 p-0" align="start">
				<Command>
					<CommandInput placeholder="Search" />
					<CommandList>
						<CommandEmpty>No phase found.</CommandEmpty>
						<CommandGroup>
							{COMPETITION_PHASE_KEYS.map((key) => {
								const selected = key === currentKey;
								return (
									<CommandItem
										key={key}
										value={key}
										onSelect={() => handleChange(key)}
										className="flex items-center justify-between"
									>
										<span className="text-xs">{getPhaseLabel(key)}</span>
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

export function EditableCompLeadCell({
	competition,
}: {
	competition: Competition;
}) {
	const users = useDataV2((state) => state.users);
	const updateCompetition = useDataV2((state) => state.updateCompetition);

	return (
		<EditableUserCell
			emptyLabel="Unassigned"
			selectedUser={competition.compLead}
			allUsers={users}
			onChange={(user) =>
				updateCompetition(competition.id, {
					compLead: user,
				})
			}
		/>
	);
}

export function EditableLeadDelegateCell({
	competition,
}: {
	competition: Competition;
}) {
	const users = useDataV2((state) => state.users);
	const updateCompetition = useDataV2((state) => state.updateCompetition);

	return (
		<EditableUserCell
			emptyLabel="Unassigned"
			selectedUser={competition.leadDelegate}
			allUsers={users}
			onChange={(user) =>
				updateCompetition(competition.id, {
					leadDelegate: user,
				})
			}
		/>
	);
}

export function EditableOrganisersCell({
	competition,
}: {
	competition: Competition;
}) {
	const users = useDataV2((state) => state.users);
	const updateCompetition = useDataV2((state) => state.updateCompetition);
	const [open, setOpen] = React.useState(false);

	const organiserIds = new Set(competition.organisers.map((u) => u.id));

	const toggleOrganiser = (user: User) => {
		const nextOrganisers = organiserIds.has(user.id)
			? competition.organisers.filter((u) => u.id !== user.id)
			: [...competition.organisers, user];
		updateCompetition(competition.id, { organisers: nextOrganisers });
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className="h-7 px-2 justify-start">
					{competition.organisers.length > 0 ? (
						<div className="flex items-center gap-1.5">
							{competition.organisers.length > 1 ? (
								<Tooltip>
									<TooltipTrigger asChild>
										<span>
											<AvatarGroup className="group-data-[size=sm]/avatar-group:*:data-[slot=avatar]:size-5">
												{competition.organisers.slice(0, 3).map((org) => (
													<Avatar key={org.id} className="size-5">
														<AvatarImage src={org.avatarUrl} alt={org.name} />
														<AvatarFallback className="text-[10px]">
															{getInitials(org.name)}
														</AvatarFallback>
													</Avatar>
												))}
												{competition.organisers.length > 3 && (
													<AvatarGroupCount className="size-5 text-[10px]">
														+{competition.organisers.length - 3}
													</AvatarGroupCount>
												)}
											</AvatarGroup>
										</span>
									</TooltipTrigger>
									<TooltipContent sideOffset={6}>
										<div className="flex flex-col gap-0.5">
											{competition.organisers
												.map((o) => o.name)
												.sort((a, b) => a.localeCompare(b))
												.map((name) => (
													<div key={name}>{name}</div>
												))}
										</div>
									</TooltipContent>
								</Tooltip>
							) : (
								<AvatarGroup className="group-data-[size=sm]/avatar-group:*:data-[slot=avatar]:size-5">
									{competition.organisers.slice(0, 1).map((org) => (
										<Avatar key={org.id} className="size-5">
											<AvatarImage src={org.avatarUrl} alt={org.name} />
											<AvatarFallback className="text-[10px]">
												{getInitials(org.name)}
											</AvatarFallback>
										</Avatar>
									))}
								</AvatarGroup>
							)}
							{competition.organisers.length === 1 && (
								<span className="text-xs truncate max-w-[140px]">
									{competition.organisers[0].name}
								</span>
							)}
						</div>
					) : (
						<span className="text-xs text-muted-foreground">None</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56 p-0" align="start">
				<Command>
					<CommandInput placeholder="Toggle organisers..." />
					<CommandList>
						<CommandEmpty>No user found.</CommandEmpty>
						<CommandGroup>
							{users.map((user) => {
								const selected = organiserIds.has(user.id);
								return (
									<CommandItem
										key={user.id}
										value={user.name}
										onSelect={() => toggleOrganiser(user)}
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
					</CommandList>
				</Command>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
