import { useMemo, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
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
import {
	useAdminMembersAndTeams,
	useAdminMemberMutations,
} from "@/hooks/use-convex-data";
import type { Id } from "@/convex/_generated/dataModel";
import { parseTeamId } from "@/lib/convex-ids";
import { Loader2, X } from "lucide-react";

const getErrorMessage = (error: unknown) =>
	error instanceof Error ? error.message : "Something went wrong.";

export function MembersAndTeamsSection() {
	const { users, teams, pendingTeamMembers, isLoading } =
		useAdminMembersAndTeams();
	const { updateTeamMembers, addPendingTeamMember, removePendingTeamMember } =
		useAdminMemberMutations();

	const [selectedTeamId, setSelectedTeamId] = useState<Id<"teams"> | null>(
		null,
	);
	const [pendingEmail, setPendingEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSavingPending, setIsSavingPending] = useState(false);
	const [removingPendingId, setRemovingPendingId] =
		useState<Id<"pendingTeamMembers"> | null>(null);

	const selectedTeam = useMemo(
		() => teams.find((t) => t.id === selectedTeamId) ?? null,
		[teams, selectedTeamId],
	);
	const pendingForSelectedTeam = useMemo(
		() => pendingTeamMembers.filter((row) => row.teamId === selectedTeamId),
		[pendingTeamMembers, selectedTeamId],
	);

	const handleToggleMember = useCallback(
		async (userId: Id<"users">) => {
			if (!selectedTeam) return;
			const isMember = selectedTeam.memberIds.includes(userId);
			const nextMembers = isMember
				? selectedTeam.memberIds.filter((id) => id !== userId)
				: [...selectedTeam.memberIds, userId];
			setError(null);
			try {
				await updateTeamMembers(selectedTeam.id, nextMembers);
			} catch (e) {
				setError(getErrorMessage(e));
			}
		},
		[selectedTeam, updateTeamMembers],
	);
	const handleAddPendingMember = useCallback(async () => {
		if (!selectedTeam) return;
		const email = pendingEmail.trim();
		if (!email) return;

		setIsSavingPending(true);
		setError(null);
		try {
			await addPendingTeamMember(selectedTeam.id, email);
			setPendingEmail("");
		} catch (e) {
			setError(getErrorMessage(e));
		} finally {
			setIsSavingPending(false);
		}
	}, [selectedTeam, pendingEmail, addPendingTeamMember]);

	const handleRemovePendingMember = useCallback(
		async (pendingTeamMemberId: Id<"pendingTeamMembers">) => {
			setRemovingPendingId(pendingTeamMemberId);
			setError(null);
			try {
				await removePendingTeamMember(pendingTeamMemberId);
			} catch (e) {
				setError(getErrorMessage(e));
			} finally {
				setRemovingPendingId(null);
			}
		},
		[removePendingTeamMember],
	);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Members &amp; Teams</CardTitle>
				</CardHeader>
				<CardContent className="py-8 flex items-center justify-center">
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<span>Members &amp; Teams</span>
					<span className="text-xs text-muted-foreground">
						Manage team membership and Directors
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">Team</span>
					<Select
						value={selectedTeamId ?? ""}
						onValueChange={(value) => setSelectedTeamId(parseTeamId(value))}
					>
						<SelectTrigger className="w-56">
							<SelectValue placeholder="Select a team" />
						</SelectTrigger>
						<SelectContent>
							{teams.map((team) => (
								<SelectItem key={team.id} value={team.id}>
									{team.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{error ? <div className="text-xs text-destructive">{error}</div> : null}

				{!selectedTeam ? (
					<div className="text-sm text-muted-foreground">
						Select a team to edit its members.
					</div>
				) : (
					<div className="space-y-3">
						<div className="text-xs font-medium text-muted-foreground">
							Click a user to add/remove them from{" "}
							<span className="font-semibold">{selectedTeam.name}</span>.
						</div>
						<div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
							{users.map((user) => {
								const isMember = selectedTeam.memberIds.includes(user.id);
								const isDirectorTeam =
									selectedTeam.name.toLowerCase() === "directors";
								return (
									<button
										key={user.id}
										type="button"
										onClick={() => void handleToggleMember(user.id)}
										className={`flex items-center justify-between rounded border px-3 py-1.5 text-left text-sm transition-colors ${
											isMember
												? "border-primary bg-primary/5"
												: "border-border hover:bg-muted/60"
										}`}
									>
										<span className="truncate">{user.name || "Unnamed"}</span>
										<div className="flex items-center gap-1">
											{isDirectorTeam &&
											user.teamIds.includes(selectedTeam.id) ? (
												<Badge
													variant="outline"
													className="border-warning text-warning-foreground text-[10px]"
												>
													Director
												</Badge>
											) : null}
											{isMember ? (
												<Badge
													variant="outline"
													className="text-[10px] border-primary text-primary"
												>
													Member
												</Badge>
											) : null}
										</div>
									</button>
								);
							})}
						</div>

						<div className="rounded-md border border-dashed px-3 py-2">
							<div className="text-xs font-medium text-muted-foreground">
								Pre-allocate roles before account creation
							</div>
							<p className="mt-1 text-[11px] text-muted-foreground">
								When someone signs in with this email, they will be added to{" "}
								<span className="font-semibold">{selectedTeam.name}</span>.
							</p>
							<div className="mt-2 flex flex-wrap items-center gap-2">
								<Input
									value={pendingEmail}
									onChange={(event) => setPendingEmail(event.target.value)}
									onKeyDown={(event) => {
										if (event.key !== "Enter") return;
										event.preventDefault();
										void handleAddPendingMember();
									}}
									placeholder="name@example.com"
									className="h-8 w-64 max-w-full text-xs"
								/>
								<Button
									size="sm"
									className="h-8 text-xs"
									onClick={() => void handleAddPendingMember()}
									disabled={isSavingPending || pendingEmail.trim().length === 0}
								>
									{isSavingPending ? (
										<Loader2 className="size-3.5 animate-spin" />
									) : (
										"Add email"
									)}
								</Button>
							</div>

							{pendingForSelectedTeam.length === 0 ? (
								<div className="mt-2 text-[11px] text-muted-foreground">
									No pre-allocated emails for this team.
								</div>
							) : (
								<div className="mt-2 space-y-1">
									{pendingForSelectedTeam.map((row) => (
										<div
											key={row.id}
											className="flex items-center justify-between rounded border px-2 py-1 text-xs"
										>
											<span className="truncate">{row.email}</span>
											<Button
												type="button"
												size="icon"
												variant="ghost"
												className="size-6"
												onClick={() => void handleRemovePendingMember(row.id)}
												disabled={removingPendingId === row.id}
											>
												{removingPendingId === row.id ? (
													<Loader2 className="size-3 animate-spin" />
												) : (
													<X className="size-3.5" />
												)}
											</Button>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
