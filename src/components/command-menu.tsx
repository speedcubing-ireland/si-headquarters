import { useNavigate } from "@tanstack/react-router";
import {
	Calendar,
	CheckSquare,
	Home,
	Inbox,
	Plus,
	Search,
	Trophy,
	User as UserIcon,
	Users,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import { useDataV2 } from "@/data/data-store-v2";
import type { Competition, Task, Team, User } from "@/data/types-new";
import { getStatusIcon } from "@/lib/task-utils";

type SearchResult =
	| { type: "task"; item: Task }
	| { type: "competition"; item: Competition }
	| { type: "user"; item: User }
	| { type: "team"; item: Team };

interface CommandMenuProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search);

	// Get all data from store
	const tasks = useDataV2((state) => state.tasks);
	const competitions = useDataV2((state) => state.competitions);
	const users = useDataV2((state) => state.users);
	const teams = useDataV2((state) => state.teams);

	// Pre-compute lowercase search query to avoid repeated conversions
	const searchQuery = useMemo(
		() => deferredSearch.trim().toLowerCase(),
		[deferredSearch],
	);

	// Filter results based on search - optimized for performance
	const results = useMemo(() => {
		if (!searchQuery) return [];

		const results: SearchResult[] = [];
		const query = searchQuery;

		// Search tasks - limit to 5
		let taskCount = 0;
		for (const task of tasks) {
			if (taskCount >= 5) break;
			if (
				task.title.toLowerCase().includes(query) ||
				task.identifier.toLowerCase().includes(query)
			) {
				results.push({ type: "task", item: task });
				taskCount++;
			}
		}

		// Search competitions - limit to 5
		let compCount = 0;
		for (const comp of competitions) {
			if (compCount >= 5) break;
			if (comp.name.toLowerCase().includes(query)) {
				results.push({ type: "competition", item: comp });
				compCount++;
			}
		}

		// Search users - limit to 3
		let userCount = 0;
		for (const user of users) {
			if (userCount >= 3) break;
			if (user.name.toLowerCase().includes(query)) {
				results.push({ type: "user", item: user });
				userCount++;
			}
		}

		// Search teams - limit to 3
		let teamCount = 0;
		for (const team of teams) {
			if (teamCount >= 3) break;
			if (team.name.toLowerCase().includes(query)) {
				results.push({ type: "team", item: team });
				teamCount++;
			}
		}

		return results;
	}, [searchQuery, tasks, competitions, users, teams]);

	// Group results by type
	const groupedResults = useMemo(() => {
		return {
			tasks: results.filter((r) => r.type === "task"),
			competitions: results.filter((r) => r.type === "competition"),
			users: results.filter((r) => r.type === "user"),
			teams: results.filter((r) => r.type === "team"),
		};
	}, [results]);

	// Quick actions when no search
	const quickActions = [
		{
			icon: Plus,
			label: "Create Task",
			shortcut: "C",
			action: () => {
				onOpenChange(false);
				// Trigger the global create task shortcut
				window.dispatchEvent(new CustomEvent("create-task-shortcut"));
			},
		},
		{
			icon: Plus,
			label: "Create Competition",
			action: () => {
				onOpenChange(false);
				// Open competition modal via custom event
				window.dispatchEvent(new CustomEvent("open-competition-modal"));
			},
		},
		{
			icon: Home,
			label: "Go to Dashboard",
			shortcut: "G D",
			action: () => {
				navigate({ to: "/" });
				onOpenChange(false);
			},
		},
		{
			icon: CheckSquare,
			label: "Go to All Tasks",
			shortcut: "G T",
			action: () => {
				navigate({ to: "/tasks" });
				onOpenChange(false);
			},
		},
		{
			icon: UserIcon,
			label: "Go to My Tasks",
			shortcut: "G M",
			action: () => {
				navigate({ to: "/tasks/my" });
				onOpenChange(false);
			},
		},
		{
			icon: Trophy,
			label: "Go to Competitions",
			shortcut: "G C",
			action: () => {
				navigate({ to: "/competitions" });
				onOpenChange(false);
			},
		},
		{
			icon: Calendar,
			label: "Go to Calendar",
			action: () => {
				navigate({ to: "/competitions/calendar" });
				onOpenChange(false);
			},
		},
		{
			icon: Inbox,
			label: "Go to Inbox",
			shortcut: "G I",
			action: () => {
				navigate({ to: "/inbox" });
				onOpenChange(false);
			},
		},
	];

	// Reset search when dialog closes
	useEffect(() => {
		if (!open) {
			setTimeout(() => setSearch(""), 200);
		}
	}, [open]);

	const hasResults = results.length > 0;

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			commandProps={{ shouldFilter: false }}
		>
			<CommandInput
				placeholder="Search tasks, competitions, people..."
				value={search}
				onValueChange={setSearch}
			/>
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>

				{hasResults ? (
					<>
						{groupedResults.tasks.length > 0 && (
							<CommandGroup heading="Tasks">
								{groupedResults.tasks.map((result) => {
									const task = result.item as Task;
									const StatusIcon = getStatusIcon(task.status);
									return (
										<CommandItem
											key={task.id}
											onSelect={() => {
												navigate({
													to: "/tasks/$id",
													params: { id: task.id },
												});
												onOpenChange(false);
											}}
										>
											<CheckSquare className="size-4" />
											<span className="font-mono text-muted-foreground text-xs">
												{task.identifier}
											</span>
											<span className="truncate">{task.title}</span>
											<StatusIcon className="size-3 ml-auto opacity-50" />
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}

						{groupedResults.competitions.length > 0 && (
							<CommandGroup heading="Competitions">
								{groupedResults.competitions.map((result) => {
									const comp = result.item as Competition;
									return (
										<CommandItem
											key={comp.id}
											onSelect={() => {
												navigate({
													to: "/competitions/$id",
													params: { id: comp.id },
												});
												onOpenChange(false);
											}}
										>
											<Trophy className="size-4" />
											<span className="truncate">{comp.name}</span>
											<span className="text-muted-foreground text-xs ml-auto">
												{comp.phases[comp.currentPhaseIdx]?.name}
											</span>
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}

						{groupedResults.users.length > 0 && (
							<CommandGroup heading="People">
								{groupedResults.users.map((result) => {
									const user = result.item as User;
									return (
										<CommandItem
											key={user.id}
											onSelect={() => {
												// Could navigate to user profile in future
												navigate({
													to: "/tasks",
													search: { assignee: user.id },
												});
												onOpenChange(false);
											}}
										>
											<UserIcon className="size-4" />
											<span>{user.name}</span>
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}

						{groupedResults.teams.length > 0 && (
							<CommandGroup heading="Teams">
								{groupedResults.teams.map((result) => {
									const team = result.item as Team;
									return (
										<CommandItem
											key={team.id}
											onSelect={() => {
												navigate({
													to: "/teams/$teamId",
													params: { teamId: team.id },
												});
												onOpenChange(false);
											}}
										>
											<Users className="size-4" />
											<span>{team.name}</span>
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}
					</>
				) : (
					<>
						<CommandGroup heading="Quick Actions">
							{quickActions.map((action) => (
								<CommandItem key={action.label} onSelect={action.action}>
									<action.icon className="size-4" />
									<span>{action.label}</span>
									{action.shortcut && (
										<CommandShortcut>{action.shortcut}</CommandShortcut>
									)}
								</CommandItem>
							))}
						</CommandGroup>

						<CommandSeparator />

						<CommandGroup heading="Navigation">
							<CommandItem
								onSelect={() => {
									navigate({ to: "/" });
									onOpenChange(false);
								}}
							>
								<Home className="size-4" />
								Dashboard
							</CommandItem>
							<CommandItem
								onSelect={() => {
									navigate({ to: "/inbox" });
									onOpenChange(false);
								}}
							>
								<Inbox className="size-4" />
								Inbox
							</CommandItem>
							<CommandItem
								onSelect={() => {
									navigate({ to: "/tasks/my" });
									onOpenChange(false);
								}}
							>
								<UserIcon className="size-4" />
								My Tasks
							</CommandItem>
						</CommandGroup>

						<CommandSeparator />

						<CommandGroup heading="Recent">
							<CommandItem disabled>
								<Search className="size-4 opacity-50" />
								<span className="text-muted-foreground">
									Start typing to search...
								</span>
							</CommandItem>
						</CommandGroup>
					</>
				)}
			</CommandList>
		</CommandDialog>
	);
}
