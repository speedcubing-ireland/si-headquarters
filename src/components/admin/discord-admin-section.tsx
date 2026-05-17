import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Bot, Link2, Loader2, RefreshCw, Unlink2 } from "lucide-react";
import { toast } from "sonner";
import {
	useDiscordActions,
	useDiscordAdminLinks,
	useDiscordMutations,
} from "@/hooks/use-convex-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

type GuildMember = Awaited<
	ReturnType<ReturnType<typeof useDiscordActions>["listGuildMembers"]>
>[number];

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message.trim()
		? error.message
		: fallback;
}

function DiscordMemberCombobox({
	selectedDiscordUserId,
	onSelect,
	members,
	disabled,
}: {
	selectedDiscordUserId?: string;
	onSelect: (discordUserId: string) => void;
	members: GuildMember[];
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);

	const selectedMember = members.find(
		(m) => m.discordUserId === selectedDiscordUserId,
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className="w-full justify-between"
				>
					{selectedMember ? (
						<span className="flex min-w-0 items-center gap-2">
							<Avatar className="size-5 shrink-0">
								<AvatarImage src={selectedMember.discordAvatarUrl} />
								<AvatarFallback className="text-[10px]">
									{(selectedMember.discordDisplayName ??
										selectedMember.discordUsername)[0]?.toUpperCase() ?? "?"}
								</AvatarFallback>
							</Avatar>
							<span className="truncate">
								{selectedMember.discordDisplayName ??
									selectedMember.discordUsername}
							</span>
						</span>
					) : (
						<span className="text-muted-foreground">Choose Discord member</span>
					)}
					<ChevronsUpDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[var(--radix-popover-trigger-width)] p-0"
				align="start"
			>
				<Command>
					<CommandInput placeholder="Search Discord members..." />
					<CommandList>
						<CommandEmpty>No member found.</CommandEmpty>
						<CommandGroup>
							{members.map((member) => {
								const label =
									member.discordDisplayName ?? member.discordUsername;
								const searchValue = member.discordDisplayName
									? `${member.discordDisplayName} ${member.discordUsername}`
									: member.discordUsername;
								return (
									<CommandItem
										key={member.discordUserId}
										value={searchValue}
										onSelect={() => {
											onSelect(member.discordUserId);
											setOpen(false);
										}}
									>
										<Avatar className="size-6 shrink-0">
											<AvatarImage src={member.discordAvatarUrl} />
											<AvatarFallback className="text-xs">
												{(member.discordDisplayName ??
													member.discordUsername)[0]?.toUpperCase() ?? "?"}
											</AvatarFallback>
										</Avatar>
										<div className="flex flex-col">
											<span>{label}</span>
											{member.discordDisplayName ? (
												<span className="text-xs text-muted-foreground">
													@{member.discordUsername}
												</span>
											) : null}
										</div>
										<Check
											className={cn(
												"ml-auto size-4",
												selectedDiscordUserId === member.discordUserId
													? "opacity-100"
													: "opacity-0",
											)}
										/>
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

export function DiscordAdminSection() {
	const { users, isLoading } = useDiscordAdminLinks();
	const { setUserLink, clearUserLink } = useDiscordMutations();
	const { listGuildMembers, listGuildChannels, registerSlashCommands } =
		useDiscordActions();
	const [query, setQuery] = useState("");
	const [members, setMembers] = useState<GuildMember[]>([]);
	const [channelCount, setChannelCount] = useState<number | null>(null);
	const [isRefreshingMembers, setIsRefreshingMembers] = useState(false);
	const [isRefreshingChannels, setIsRefreshingChannels] = useState(false);
	const [isRegisteringCommands, setIsRegisteringCommands] = useState(false);
	const [selectedMemberByUserId, setSelectedMemberByUserId] = useState<
		Record<string, string>
	>({});
	const [busyUserId, setBusyUserId] = useState<Id<"users"> | null>(null);

	const filteredUsers = useMemo(() => {
		const trimmed = query.trim().toLowerCase();
		if (!trimmed) {
			return users;
		}
		return users.filter(
			(user: (typeof users)[number]) =>
				user.name.toLowerCase().includes(trimmed) ||
				user.email.toLowerCase().includes(trimmed) ||
				user.link?.discordUsername.toLowerCase().includes(trimmed) ||
				user.link?.discordDisplayName?.toLowerCase().includes(trimmed),
		);
	}, [query, users]);

	const refreshMembers = async () => {
		setIsRefreshingMembers(true);
		try {
			const nextMembers = await listGuildMembers();
			setMembers(nextMembers);
			toast.success(`Loaded ${nextMembers.length} Discord members.`);
		} catch (error) {
			toast.error(toErrorMessage(error, "Failed to load Discord members."));
		} finally {
			setIsRefreshingMembers(false);
		}
	};

	const refreshChannels = async () => {
		setIsRefreshingChannels(true);
		try {
			const channels = await listGuildChannels();
			setChannelCount(channels.length);
			toast.success(`Loaded ${channels.length} Discord channels.`);
		} catch (error) {
			toast.error(toErrorMessage(error, "Failed to load Discord channels."));
		} finally {
			setIsRefreshingChannels(false);
		}
	};

	const handleRegisterCommands = async () => {
		setIsRegisteringCommands(true);
		try {
			const commands = await registerSlashCommands();
			toast.success(`Registered ${commands.length} Discord commands.`);
		} catch (error) {
			toast.error(
				toErrorMessage(error, "Failed to register Discord commands."),
			);
		} finally {
			setIsRegisteringCommands(false);
		}
	};

	const handleLinkUser = async (userId: Id<"users">) => {
		const selectedDiscordUserId = selectedMemberByUserId[userId];
		const member = members.find(
			(candidate) => candidate.discordUserId === selectedDiscordUserId,
		);
		if (!member) {
			toast.error("Choose a Discord guild member first.");
			return;
		}
		setBusyUserId(userId);
		try {
			await setUserLink({
				userId,
				discordUserId: member.discordUserId,
				discordUsername: member.discordUsername,
				discordDisplayName: member.discordDisplayName,
				discordAvatarUrl: member.discordAvatarUrl,
			});
			toast.success("Discord account linked.");
		} catch (error) {
			toast.error(toErrorMessage(error, "Failed to link Discord account."));
		} finally {
			setBusyUserId(null);
		}
	};

	const handleClearLink = async (userId: Id<"users">) => {
		setBusyUserId(userId);
		try {
			await clearUserLink(userId);
			toast.success("Discord link removed.");
		} catch (error) {
			toast.error(toErrorMessage(error, "Failed to remove Discord link."));
		} finally {
			setBusyUserId(null);
		}
	};

	return (
		<Card>
			<CardHeader className="gap-3">
				<CardTitle className="flex items-center gap-2">
					<Bot className="size-4 text-muted-foreground" />
					Discord
				</CardTitle>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => void refreshMembers()}
						disabled={isRefreshingMembers}
					>
						{isRefreshingMembers ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<RefreshCw className="size-4" />
						)}
						Refresh members
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => void refreshChannels()}
						disabled={isRefreshingChannels}
					>
						{isRefreshingChannels ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<RefreshCw className="size-4" />
						)}
						Refresh channels
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => void handleRegisterCommands()}
						disabled={isRegisteringCommands}
					>
						{isRegisteringCommands ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Bot className="size-4" />
						)}
						Register commands
					</Button>
				</div>
				<p className="text-xs text-muted-foreground">
					{members.length > 0
						? `${members.length} guild members loaded.`
						: "Load guild members to start linking accounts."}
					{channelCount !== null ? ` ${channelCount} channels loaded.` : ""}
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Filter Headquarters users"
				/>
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="space-y-2">
						{filteredUsers.map((user: (typeof filteredUsers)[number]) => {
							const busy = busyUserId === user.userId;
							return (
								<div
									key={user.userId}
									className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-sm">
											{user.name || "Unnamed user"}
										</p>
										<p className="truncate text-xs text-muted-foreground">
											{user.email}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{user.link ? "Linked to Discord" : "Not linked"}
										</p>
									</div>
									{user.link ? (
										<div className="flex items-center gap-3 rounded-md border border-border/50 bg-muted/30 p-2">
											<Avatar className="size-8 shrink-0">
												<AvatarImage src={user.link.discordAvatarUrl} />
												<AvatarFallback className="text-xs">
													{(user.link.discordDisplayName ??
														user.link.discordUsername)[0]?.toUpperCase() ?? "?"}
												</AvatarFallback>
											</Avatar>
											<div className="min-w-0">
												<p className="truncate text-sm font-medium">
													{user.link.discordDisplayName ??
														user.link.discordUsername}
												</p>
												<p className="truncate text-xs text-muted-foreground">
													@{user.link.discordUsername}
												</p>
											</div>
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={() => void handleClearLink(user.userId)}
												disabled={busy}
											>
												{busy ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													<Unlink2 className="size-4" />
												)}
												Unlink
											</Button>
										</div>
									) : (
										<div className="flex items-center gap-2">
											<div className="min-w-0 flex-1">
												<DiscordMemberCombobox
													selectedDiscordUserId={
														selectedMemberByUserId[user.userId]
													}
													onSelect={(value) =>
														setSelectedMemberByUserId((current) => ({
															...current,
															[user.userId]: value,
														}))
													}
													members={members}
												/>
											</div>
											<Button
												type="button"
												size="sm"
												className="shrink-0"
												onClick={() => void handleLinkUser(user.userId)}
												disabled={busy || members.length === 0}
											>
												{busy ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													<Link2 className="size-4" />
												)}
												Link
											</Button>
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
