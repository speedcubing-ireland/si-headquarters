import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	Bell,
	Calendar,
	CheckSquare,
	Home,
	Inbox,
	Plus,
	Search,
	Trophy,
	User as UserIcon,
	Users,
	X,
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
import {
	buildOneTimeReminderPayload,
	useTasks,
	useUsers,
	useTeams,
	useCompetitions,
	useCommentsForSearch,
	usePendingRemindersForTask,
	useReminderMutations,
} from "@/hooks/use-convex-data";
import type { Competition, Task, Team, User } from "@/data/types-new";
import { getStatusIcon } from "@/lib/task-utils";
import { REMINDER_PRESETS } from "@/lib/reminder-presets";

type SearchResult =
	| { type: "task"; item: Task }
	| { type: "competition"; item: Competition }
	| { type: "user"; item: User }
	| { type: "team"; item: Team };

interface CommandMenuProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const TASKS_PATH_PREFIX = "/tasks/";
const TASKS_NON_DETAIL_PATHS = new Set([
	"/tasks",
	"/tasks/my",
	"/tasks/archived",
]);

function useCurrentTaskId(): string | null {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	if (
		!pathname.startsWith(TASKS_PATH_PREFIX) ||
		TASKS_NON_DETAIL_PATHS.has(pathname)
	) {
		return null;
	}
	const segments = pathname.split("/").filter(Boolean);
	return segments[0] === "tasks" && segments[1] ? segments[1] : null;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search);
	const currentTaskId = useCurrentTaskId();
	const { reminders: pendingForTask } = usePendingRemindersForTask(
		currentTaskId ?? null,
	);
	const { addReminder, cancelReminder } = useReminderMutations();
	const { tasks } = useTasks(false);
	const { competitions } = useCompetitions();
	const { users } = useUsers();
	const { teams } = useTeams();
	const { comments } = useCommentsForSearch();

	const searchQuery = useMemo(
		() => deferredSearch.trim().toLowerCase(),
		[deferredSearch],
	);

	const results = useMemo(() => {
		if (!searchQuery) return [];

		const results: SearchResult[] = [];
		const query = searchQuery;
		const queryWords = query.split(/\s+/).filter((w) => w.length > 0);

		const calculateScore = (text: string, query: string): number => {
			const lowerText = text.toLowerCase();
			const lowerQuery = query.toLowerCase();

			// Exact match gets highest score
			if (lowerText === lowerQuery) return 100;

			// Starts with query gets high score
			if (lowerText.startsWith(lowerQuery)) return 80;

			// Contains query gets medium score
			if (lowerText.includes(lowerQuery)) return 60;

			// All words match (in any order) gets lower score
			if (queryWords.every((word) => lowerText.includes(word))) return 40;

			// Some words match
			const matchingWords = queryWords.filter((word) =>
				lowerText.includes(word),
			);
			if (matchingWords.length > 0) {
				return (matchingWords.length / queryWords.length) * 30;
			}

			return 0;
		};

		// Search tasks with enhanced matching
		const taskScores = new Map<
			string,
			{ task: Task; score: number; context?: string }
		>();

		for (const task of tasks) {
			let score = 0;
			let context: string | undefined;

			// Title match (highest priority)
			const titleScore = calculateScore(task.title, query);
			if (titleScore > 0) {
				score += titleScore;
			}

			// Identifier match
			if (task.identifier.toLowerCase().includes(query)) {
				score += 70;
			}

			// Description match (lower priority, include snippet)
			if (task.description) {
				const descScore = calculateScore(task.description.slice(0, 200), query);
				if (descScore > 0) {
					score += descScore * 0.5;
					// Extract context snippet
					const index = task.description
						.toLowerCase()
						.indexOf(query.toLowerCase());
					if (index !== -1) {
						const start = Math.max(0, index - 30);
						const end = Math.min(
							task.description.length,
							index + query.length + 30,
						);
						context = `...${task.description.slice(start, end)}...`;
					}
				}
			}

			// Status search (e.g., "done", "in progress")
			if (query.includes(task.status.toLowerCase())) {
				score += 50;
			}

			// Priority search
			if (query.includes(task.priority.toLowerCase())) {
				score += 40;
			}

			// Assignee name match
			if (task.assignee) {
				const assigneeScore = calculateScore(task.assignee.name, query);
				if (assigneeScore > 0) {
					score += assigneeScore * 0.7;
				}
			}

			if (score > 0) {
				taskScores.set(task.id, { task, score, context });
			}
		}

		// Search in comments for task matches
		for (const comment of comments) {
			if (comment.parentType !== "task") continue;
			if (!comment.content.toLowerCase().includes(query)) continue;

			const task = tasks.find((t) => t.id === comment.parentId);
			if (!task) continue;

			const existing = taskScores.get(task.id);
			if (existing) {
				existing.score += 20; // Boost for comment match
			} else {
				// Add task with lower score since only comment matched
				taskScores.set(task.id, {
					task,
					score: 25,
					context: "Mentioned in comments",
				});
			}
		}

		// Sort tasks by score and add to results
		const sortedTasks = Array.from(taskScores.values())
			.sort((a, b) => b.score - a.score)
			.slice(0, 6);

		for (const { task } of sortedTasks) {
			results.push({ type: "task", item: task });
		}

		// Search competitions
		const compScores = new Map<string, { comp: Competition; score: number }>();

		for (const comp of competitions) {
			let score = 0;

			const nameScore = calculateScore(comp.name, query);
			if (nameScore > 0) {
				score += nameScore;
			}

			if (comp.description) {
				const descScore = calculateScore(comp.description, query);
				if (descScore > 0) {
					score += descScore * 0.5;
				}
			}

			// Phase name match
			for (const phase of comp.phases) {
				if (phase.name.toLowerCase().includes(query)) {
					score += 30;
					break;
				}
			}

			if (score > 0) {
				compScores.set(comp.id, { comp, score });
			}
		}

		const sortedComps = Array.from(compScores.values())
			.sort((a, b) => b.score - a.score)
			.slice(0, 5);

		for (const { comp } of sortedComps) {
			results.push({ type: "competition", item: comp });
		}

		// Search users
		let userCount = 0;
		const sortedUsers = users
			.map((user) => ({
				user,
				score: calculateScore(user.name, query),
			}))
			.filter((u) => u.score > 0)
			.sort((a, b) => b.score - a.score);

		for (const { user } of sortedUsers.slice(0, 4)) {
			if (userCount >= 4) break;
			results.push({ type: "user", item: user });
			userCount++;
		}

		// Search teams
		let teamCount = 0;
		const sortedTeams = teams
			.map((team) => ({
				team,
				score: calculateScore(team.name, query),
			}))
			.filter((t) => t.score > 0)
			.sort((a, b) => b.score - a.score);

		for (const { team } of sortedTeams.slice(0, 3)) {
			if (teamCount >= 3) break;
			results.push({ type: "team", item: team });
			teamCount++;
		}

		return results;
	}, [searchQuery, tasks, competitions, users, teams, comments]);

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

				{currentTaskId && (
					<CommandGroup heading="Current task">
						{REMINDER_PRESETS.filter((p) => p.key !== "custom").map(
							(preset) => (
								<CommandItem
									key={preset.key}
									onSelect={() => {
										void addReminder(
											buildOneTimeReminderPayload(
												currentTaskId,
												preset.getRemindAt(),
											),
										);
										onOpenChange(false);
									}}
								>
									<Bell className="size-4" />
									Remind me: {preset.label}
								</CommandItem>
							),
						)}
						{pendingForTask.length > 0 && (
							<CommandItem
								onSelect={() => {
									void cancelReminder(pendingForTask[0].id);
									onOpenChange(false);
								}}
							>
								<X className="size-4" />
								Cancel reminder
							</CommandItem>
						)}
					</CommandGroup>
				)}
				{currentTaskId && (hasResults || !searchQuery) && <CommandSeparator />}

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
