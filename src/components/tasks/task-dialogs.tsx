import { useState } from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useUsers, useTeams, useTasks } from "@/hooks/use-convex-data";
import type { Task, Team, User } from "@/data/types-new";

export function AddApproverDialog({
	open,
	onOpenChange,
	task,
	onAdd,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	task: Task;
	onAdd: (approver: Team | User) => void;
}) {
	const { users } = useUsers();
	const { teams } = useTeams();
	const [search, setSearch] = useState("");

	const existingApproverIds = new Set([
		...task.requiredApprovalBy.map((a) => a.id),
		...(task.assignee ? [task.assignee.id] : []),
	]);

	const filteredUsers = users.filter(
		(u) =>
			!existingApproverIds.has(u.id) &&
			u.name.toLowerCase().includes(search.toLowerCase()),
	);

	const filteredTeams = teams.filter(
		(t) =>
			!existingApproverIds.has(t.id) &&
			t.name.toLowerCase().includes(search.toLowerCase()),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[400px]">
				<DialogHeader>
					<DialogTitle>Add Required Approver</DialogTitle>
				</DialogHeader>
				<Command>
					<CommandInput
						placeholder="Search people or teams..."
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						{filteredTeams.length > 0 && (
							<CommandGroup heading="Teams">
								{filteredTeams.map((team) => (
									<CommandItem
										key={team.id}
										onSelect={() => {
											onAdd(team);
											onOpenChange(false);
											setSearch("");
										}}
									>
										<div className="flex items-center gap-2">
											<div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
												T
											</div>
											<span>{team.name}</span>
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{filteredUsers.length > 0 && (
							<CommandGroup heading="People">
								{filteredUsers.map((user) => (
									<CommandItem
										key={user.id}
										onSelect={() => {
											onAdd(user);
											onOpenChange(false);
											setSearch("");
										}}
									>
										<div className="flex items-center gap-2">
											{user.avatarUrl ? (
												<img
													src={user.avatarUrl}
													alt={user.name}
													className="w-6 h-6 rounded-full"
												/>
											) : null}
											<span>{user.name}</span>
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}

export function AddBlockingTaskDialog({
	open,
	onOpenChange,
	task,
	onAddBlockingTask,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	task: Task;
	onAddBlockingTask: (blockingTaskId: Task["id"]) => void;
}) {
	const { tasks } = useTasks(false);
	const [search, setSearch] = useState("");

	const existingBlockingTaskIds = new Set(
		task.blockedBy.map((relation) => relation.task.id),
	);
	const currentCompetitionId =
		task.parent?.type === "competition" ? task.parent.linkedId : null;
	const filteredTasks = tasks.filter((candidate) => {
		if (candidate.id === task.id) {
			return false;
		}
		if (existingBlockingTaskIds.has(candidate.id)) {
			return false;
		}
		const candidateCompetitionId =
			candidate.parent?.type === "competition"
				? candidate.parent.linkedId
				: null;
		if (candidateCompetitionId !== currentCompetitionId) {
			return false;
		}
		const candidateText =
			`${candidate.identifier} ${candidate.title}`.toLowerCase();
		return candidateText.includes(search.toLowerCase());
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[520px]">
				<DialogHeader>
					<DialogTitle>Add Blocking Task</DialogTitle>
				</DialogHeader>
				<Command>
					<CommandInput
						placeholder="Search tasks..."
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList>
						<CommandEmpty>No matching tasks.</CommandEmpty>
						{filteredTasks.length > 0 && (
							<CommandGroup heading="Tasks">
								{filteredTasks.map((candidate) => (
									<CommandItem
										key={candidate.id}
										onSelect={() => {
											onAddBlockingTask(candidate.id);
											onOpenChange(false);
											setSearch("");
										}}
									>
										<div className="flex min-w-0 flex-col">
											<span className="truncate text-xs text-muted-foreground">
												{candidate.identifier}
											</span>
											<span className="truncate text-sm">
												{candidate.title}
											</span>
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}
