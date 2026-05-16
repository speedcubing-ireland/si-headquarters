import { useMemo, useState } from "react";
import { Bot, Link2, Loader2, RefreshCw, Unlink2 } from "lucide-react";
import { toast } from "sonner";
import {
	useDiscordActions,
	useDiscordAdminLinks,
	useDiscordMutations,
} from "@/hooks/use-convex-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Id } from "@/convex/_generated/dataModel";

type GuildMember = Awaited<
	ReturnType<ReturnType<typeof useDiscordActions>["listGuildMembers"]>
>[number];

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message.trim()
		? error.message
		: fallback;
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
									className="grid gap-3 rounded-lg border border-border/70 p-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
								>
									<div className="min-w-0">
										<p className="truncate font-medium text-sm">
											{user.name || "Unnamed user"}
										</p>
										<p className="truncate text-xs text-muted-foreground">
											{user.email}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{user.link
												? `Linked to ${user.link.discordDisplayName ?? user.link.discordUsername}`
												: "Not linked"}
										</p>
									</div>
									<Select
										value={selectedMemberByUserId[user.userId] ?? ""}
										onValueChange={(value) =>
											setSelectedMemberByUserId((current) => ({
												...current,
												[user.userId]: value,
											}))
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Choose Discord member" />
										</SelectTrigger>
										<SelectContent>
											{members.map((member) => (
												<SelectItem
													key={member.discordUserId}
													value={member.discordUserId}
												>
													{member.discordDisplayName ?? member.discordUsername}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<div className="flex flex-wrap items-center gap-2">
										<Button
											type="button"
											size="sm"
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
										{user.link ? (
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={() => void handleClearLink(user.userId)}
												disabled={busy}
											>
												<Unlink2 className="size-4" />
												Unlink
											</Button>
										) : null}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
