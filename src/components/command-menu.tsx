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
import Fuse from "fuse.js";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import {
	buildOneTimeReminderPayload,
	useTasks,
	useUsers,
	useTeams,
	useCompetitions,
	useIsVolunteer,
	usePendingRemindersForTask,
	useReminderMutations,
} from "@/hooks/use-convex-data";
import { useCreateModalsStore } from "@/store/create-modals-store";
import type { Competition, Task, Team, User } from "@/data/types-new";
import { getStatusIcon } from "@/lib/task-utils";
import { REMINDER_PRESETS } from "@/lib/reminder-presets";
import { parseTaskId } from "@/lib/convex-ids";
import { onMutationError } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

type TaskSearchItem = {
	type: "task";
	task: Task;
	title: string;
	identifier: string;
	description?: string | null;
	status: string;
	priority: string;
	assigneeName?: string;
};

type CompetitionSearchItem = {
	type: "competition";
	competition: Competition;
	name: string;
	description?: string | null;
	phaseNames: string[];
};

type UserSearchItem = {
	type: "user";
	user: User;
	name: string;
};

type TeamSearchItem = {
	type: "team";
	team: Team;
	name: string;
};

type SearchItem =
	| TaskSearchItem
	| CompetitionSearchItem
	| UserSearchItem
	| TeamSearchItem;

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

function useCurrentTaskId(): Id<"tasks"> | null {
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
	if (segments[0] !== "tasks" || !segments[1]) {
		return null;
	}
	return parseTaskId(segments[1]);
}

function buildSearchItems(
	tasks: Task[],
	competitions: Competition[],
	users: User[],
	teams: Team[],
): SearchItem[] {
	const taskItems: TaskSearchItem[] = tasks.map((task) => ({
		type: "task",
		task,
		title: task.title,
		identifier: task.identifier,
		description: task.description,
		status: task.status,
		priority: task.priority,
		assigneeName: task.assignee?.name,
	}));

	const competitionItems: CompetitionSearchItem[] = competitions.map(
		(competition) => ({
			type: "competition",
			competition,
			name: competition.name,
			description: competition.description,
			phaseNames: competition.phases.map((phase: Competition["phases"][number]) => phase.name),
		}),
	);

	const userItems: UserSearchItem[] = users.map((user) => ({
		type: "user",
		user,
		name: user.name,
	}));

	const teamItems: TeamSearchItem[] = teams.map((team) => ({
		type: "team",
		team,
		name: team.name,
	}));

	return [...taskItems, ...competitionItems, ...userItems, ...teamItems];
}

function createSearchFuse(searchItems: SearchItem[]): Fuse<SearchItem> {
	return new Fuse(searchItems, {
		ignoreLocation: true,
		threshold: 0.3,
		minMatchCharLength: 2,
		keys: [
			"title",
			"identifier",
			"description",
			"status",
			"priority",
			"assigneeName",
			"name",
			"phaseNames",
		],
	});
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
	const { isVolunteer } = useIsVolunteer();
	const { openTask, openCompetition } = useCreateModalsStore();

	const searchQuery = deferredSearch.trim().toLowerCase();

	const searchItems = useMemo(
		() => buildSearchItems(tasks, competitions, users, teams),
		[tasks, competitions, users, teams],
	);

	const fuse = useMemo(
		() => (searchItems.length > 0 ? createSearchFuse(searchItems) : null),
		[searchItems],
	);

	const results = useMemo<SearchItem[]>(() => {
		if (!searchQuery || !fuse) return [];
		return fuse.search(searchQuery).map(({ item }) => item);
	}, [searchQuery, fuse]);

	const taskResults = results.filter(
		(item): item is TaskSearchItem => item.type === "task",
	);
	const competitionResults = results.filter(
		(item): item is CompetitionSearchItem => item.type === "competition",
	);
	const userResults = results.filter(
		(item): item is UserSearchItem => item.type === "user",
	);
	const teamResults = results.filter(
		(item): item is TeamSearchItem => item.type === "team",
	);

	const quickActions = [
		{
			icon: Plus,
			label: "Create Task",
			action: () => {
				onOpenChange(false);
				openTask();
			},
		},
		...(isVolunteer
			? [
					{
						icon: Plus,
						label: "Create Competition",
						action: () => {
							onOpenChange(false);
							openCompetition();
						},
					},
				]
			: []),
		{
			icon: Home,
			label: "Go to Dashboard",
			action: () => {
				void navigate({ to: "/" });
				onOpenChange(false);
			},
		},
		{
			icon: CheckSquare,
			label: "Go to All Tasks",
			action: () => {
				void navigate({ to: "/tasks" });
				onOpenChange(false);
			},
		},
		{
			icon: UserIcon,
			label: "Go to My Tasks",
			action: () => {
				void navigate({ to: "/tasks/my" });
				onOpenChange(false);
			},
		},
		{
			icon: Trophy,
			label: "Go to Competitions",
			action: () => {
				void navigate({ to: "/competitions" });
				onOpenChange(false);
			},
		},
		{
			icon: Calendar,
			label: "Go to Calendar",
			action: () => {
				void navigate({ to: "/competitions/calendar" });
				onOpenChange(false);
			},
		},
		{
			icon: Inbox,
			label: "Go to Inbox",
			action: () => {
				void navigate({ to: "/inbox" });
				onOpenChange(false);
			},
		},
	];

	useEffect(() => {
		if (open) return;
		const timeoutId = window.setTimeout(() => setSearch(""), 200);
		return () => window.clearTimeout(timeoutId);
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
										).catch(onMutationError);
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
									void cancelReminder(pendingForTask[0].id).catch(
										onMutationError,
									);
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

				{hasResults && (
					<>
						{taskResults.length > 0 && (
							<CommandGroup heading="Tasks">
								{taskResults.map((result) => {
									const { task } = result;
									const StatusIcon = getStatusIcon(task.status);
									return (
										<CommandItem
											key={task.id}
											onSelect={() => {
												void navigate({
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

						{competitionResults.length > 0 && (
							<CommandGroup heading="Competitions">
								{competitionResults.map((result) => {
									const { competition } = result;
									return (
										<CommandItem
											key={competition.id}
											onSelect={() => {
												void navigate({
													to: "/competitions/$id",
													params: { id: competition.id },
												});
												onOpenChange(false);
											}}
										>
											<Trophy className="size-4" />
											<span className="truncate">{competition.name}</span>
											<span className="text-muted-foreground text-xs ml-auto">
												{competition.phases[competition.currentPhaseIdx]?.name}
											</span>
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}

						{userResults.length > 0 && (
							<CommandGroup heading="People">
								{userResults.map((result) => {
									const { user } = result;
									return (
										<CommandItem
											key={user.id}
											onSelect={() => {
												void navigate({
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

						{teamResults.length > 0 && (
							<CommandGroup heading="Teams">
								{teamResults.map((result) => {
									const { team } = result;
									return (
										<CommandItem
											key={team.id}
											onSelect={() => {
												void navigate({
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

						<CommandSeparator />
					</>
				)}

				<CommandGroup heading="Quick Actions">
					{quickActions.map((action) => (
						<CommandItem key={action.label} onSelect={action.action}>
							<action.icon className="size-4" />
							<span>{action.label}</span>
						</CommandItem>
					))}
				</CommandGroup>

				<CommandSeparator />

				<CommandGroup heading="Navigation">
					<CommandItem
						onSelect={() => {
							void navigate({ to: "/" });
							onOpenChange(false);
						}}
					>
						<Home className="size-4" />
						Dashboard
					</CommandItem>
					<CommandItem
						onSelect={() => {
							void navigate({ to: "/inbox" });
							onOpenChange(false);
						}}
					>
						<Inbox className="size-4" />
						Inbox
					</CommandItem>
					<CommandItem
						onSelect={() => {
							void navigate({ to: "/tasks/my" });
							onOpenChange(false);
						}}
					>
						<UserIcon className="size-4" />
						My Tasks
					</CommandItem>
				</CommandGroup>

				{!hasResults && (
					<>
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
