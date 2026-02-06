import { useMemo, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2 } from "lucide-react";

export function MembersAndTeamsSection() {
	const { users, teams, isLoading } = useAdminMembersAndTeams();
	const { updateTeamMembers } = useAdminMemberMutations();

	const [selectedTeamId, setSelectedTeamId] = useState<Id<"teams"> | null>(
		null,
	);

	const selectedTeam = useMemo(
		() => teams.find((t) => t.id === selectedTeamId) ?? null,
		[teams, selectedTeamId],
	);

	const handleToggleMember = useCallback(
		async (userId: Id<"users">) => {
			if (!selectedTeam) return;
			const isMember = selectedTeam.memberIds.includes(userId);
			const nextMembers = isMember
				? selectedTeam.memberIds.filter((id) => id !== userId)
				: [...selectedTeam.memberIds, userId];
			await updateTeamMembers(selectedTeam.id, nextMembers);
		},
		[selectedTeam, updateTeamMembers],
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

				{!selectedTeam ? (
					<div className="text-sm text-muted-foreground">
						Select a team to edit its members.
					</div>
				) : (
					<div className="space-y-2">
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
													className="border-amber-500 text-amber-700 text-[10px]"
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
					</div>
				)}
			</CardContent>
		</Card>
	);
}
