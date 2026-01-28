import { identicon } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { faker } from "@faker-js/faker";
import { create } from "zustand";
import {
	type Competition,
	type CompetitionPhase,
	DEFAULT_LABELS,
	DEFAULT_PHASES,
	type ProgressUpdate,
	TASK_PRIORITY,
	TASK_STATUS,
	type Task,
	type TaskLabel,
	type TaskPriority,
	type TaskStatus,
	type Team,
	type User,
} from "./types-new";

const avatarUrl = (seed: string): string => {
	const avatar = createAvatar(identicon, {
		seed,
		backgroundColor: ["ffffff"],
	});
	return `data:image/svg+xml,${encodeURIComponent(avatar.toString())}`;
};

let taskCounter = 1;

function generateTaskIdentifier(): string {
	// Linear-style, mono-spaced identifier
	return `HQ-${taskCounter++}`;
}

function generateUsers(count: number): User[] {
	return Array.from({ length: count }, () => {
		const name = faker.person.fullName();
		const seed = name.toLowerCase().replace(/\s+/g, "");
		return {
			id: faker.string.uuid(),
			name,
			avatarUrl: avatarUrl(seed),
		};
	});
}

function generateTeams(users: User[], _count: number): Team[] {
	const teamNames = ["Competitions", "Social Media", "Merchandise"] as const;

	return teamNames.map((name) => ({
		id: faker.string.uuid(),
		name,
		members: faker.helpers.arrayElements(users, { min: 2, max: 5 }),
	}));
}

function generatePhases(): CompetitionPhase[] {
	return DEFAULT_PHASES.map((phase) => ({
		id: faker.string.uuid(),
		...phase,
	}));
}

function generateTask(
	users: User[],
	teams: Team[],
	labels: TaskLabel[],
	parent: Task["parent"] = null,
	depth = 0,
): Task {
	const now = new Date().toISOString();
	const hasDueDate = faker.datatype.boolean({ probability: 0.5 });
	const hasSubTasks = depth < 2 && faker.datatype.boolean({ probability: 0.3 });

	let owner: Task["owner"] = null;
	let assignee: User | null = null;

	if (teams.length > 0) {
		// Create a healthy mix of team-owned tasks that are triaged vs. untriaged,
		// plus some user-owned and unowned tasks.
		const scenario = faker.helpers.arrayElement([
			"team_untriaged",
			"team_triaged",
			"user_owner",
			"no_owner",
		] as const);

		if (scenario === "team_untriaged") {
			const team = faker.helpers.arrayElement(teams);
			owner = team;
			assignee = null;
		} else if (scenario === "team_triaged") {
			const team = faker.helpers.arrayElement(teams);
			owner = team;
			const pool = team.members.length > 0 ? team.members : users;
			assignee = faker.helpers.arrayElement(pool);
		} else if (scenario === "user_owner") {
			const user = faker.helpers.arrayElement(users);
			owner = user;
			assignee = faker.datatype.boolean({ probability: 0.7 })
				? faker.helpers.arrayElement([user, ...users])
				: null;
		} else {
			owner = null;
			assignee = faker.datatype.boolean({ probability: 0.6 })
				? faker.helpers.arrayElement(users)
				: null;
		}
	} else {
		// Fallback if no teams exist – behave like before.
		const currentUser = users[0];
		owner = faker.datatype.boolean() ? faker.helpers.arrayElement(users) : null;
		assignee = faker.datatype.boolean({ probability: 0.8 })
			? faker.helpers.arrayElement([currentUser, currentUser, ...users])
			: null;
	}

	const task: Task = {
		id: faker.string.uuid(),
		identifier: generateTaskIdentifier(),
		parent,
		title: faker.company.catchPhrase(),
		description: faker.lorem.paragraphs({ min: 1, max: 3 }),
		owner,
		assignee,
		phase: null,
		status: faker.helpers.arrayElement([...TASK_STATUS]),
		priority: faker.helpers.arrayElement([...TASK_PRIORITY]),
		dueDate: hasDueDate
			? faker.date.future().toISOString().split("T")[0]
			: null,
		requiredApprovalBy: [],
		approvedBy: [],
		labels: faker.helpers.arrayElements(labels, { min: 0, max: 3 }),
		resources: [],
		subTasks: [],
		createdAt: now,
		updatedAt: now,
	};

	if (hasSubTasks) {
		const subTaskCount = faker.number.int({ min: 1, max: 3 });
		task.subTasks = Array.from({ length: subTaskCount }, () =>
			generateTask(
				users,
				teams,
				labels,
				{ type: "task", linkedId: task.id },
				depth + 1,
			),
		);
	}

	return task;
}

function generateTasks(
	count: number,
	users: User[],
	teams: Team[],
	labels: TaskLabel[],
): Task[] {
	return Array.from({ length: count }, () =>
		generateTask(users, teams, labels),
	);
}

function flattenTasks(tasks: Task[]): Task[] {
	const result: Task[] = [];

	const visit = (task: Task) => {
		result.push(task);
		for (const subTask of task.subTasks) {
			visit(subTask);
		}
	};

	for (const task of tasks) {
		visit(task);
	}

	return result;
}

function generateCompetition(users: User[]): Competition {
	const competitionNames = [
		"{place} Open",
		"{place} Championship",
		"{place} Speedcubing Competition",
		"{place} Cube Challenge",
		"{place} Open",
		"{place} Championship",
		"{place} Speedcubing",
		"{place} Cube Fest",
		"{place} Open",
		"Every Event {place}",
		"{place} Autumn Solving",
		"Twist and {place}",
		"Don't DNF {place}",
		"Cubing Around {place}",
		"{place} Winter Warmup",
		"{place} Spring Solves",
		"{place} Summer Cube Jam",
		"{place} Newcomer Open",
		"{place} Beginners' Challenge",
		"Solving in {place} (Open)",
		"The {place} Cube Games",
		"City Series: {place} Showdown",
		"Road to Nationals: {place} Qualifier",
		"Battle for {place}: Speed Edition",
		"{place} Speed Weekend",
		"{place} Cube Sprint",
		"{place} Side Event Showdown",
		"{place} FMC Meetup",
		"{place} Big Cubes Bonanza",
		"{place} One-Handed Open",
		"{place} Blindfolded Bash",
		"{place} Clock Clash",
		"{place} Pyraminx Party",
		"{place} Skewb Showdown",
		"{place} Multi-Blind Marathon",
		"{place} Sunday Solving Session",
		"{place} Open Invitational",
		"{place} Championship Series",
		"{place} Cube Carnival",
	];

	const place = faker.location.city();
	const year = faker.date.future().getFullYear();
	const name = `${faker.helpers.arrayElement(competitionNames).replace("{place}", place)} ${year}`;

	const phases = generatePhases();
	const currentPhaseIdx = faker.number.int({ min: 0, max: phases.length - 1 });
	const now = new Date().toISOString();
	const compStart = faker.date.future();
	const compEnd = faker.date.future({ refDate: compStart });

	const compLead = faker.helpers.arrayElement(users);
	const leadDelegate = faker.helpers.arrayElement(users);
	const organisers = faker.helpers.arrayElements(users, { min: 2, max: 5 });

	const progressUpdates: ProgressUpdate[] = [];
	if (faker.datatype.boolean({ probability: 0.7 })) {
		const updateCount = faker.number.int({ min: 1, max: 3 });
		for (let i = 0; i < updateCount; i++) {
			const author = faker.helpers.arrayElement(users);
			progressUpdates.push({
				id: faker.string.uuid(),
				timestamp: faker.date
					.recent({ days: 14, refDate: compStart })
					.toISOString(),
				postedBy: author,
				status: faker.helpers.arrayElement<ProgressUpdate["status"]>([
					"on-track",
					"at-risk",
					"off-track",
				]),
				message: faker.lorem.sentence(),
			});
		}
	}

	return {
		id: faker.string.uuid(),
		name,
		description: faker.lorem.sentence(),
		compStart: compStart.toISOString().split("T")[0],
		compEnd: compEnd.toISOString().split("T")[0],
		compLead,
		leadDelegate,
		organisers,
		phases,
		currentPhaseIdx,
		progressUpdates,
		compSheet: faker.datatype.boolean()
			? { type: "google-sheet", sheetId: faker.string.alphanumeric(32) }
			: null,
		tasks: [],
		createdAt: now,
		updatedAt: now,
	};
}

function generateCompetitions(count: number, users: User[]): Competition[] {
	return Array.from({ length: count }, () => generateCompetition(users));
}

const mockUsers = generateUsers(50);
const mockTeams = generateTeams(mockUsers, 3);
const mockLabels = [...DEFAULT_LABELS];
const mockTasks = flattenTasks(
	generateTasks(40, mockUsers, mockTeams, mockLabels),
);
const mockCompetitions = generateCompetitions(30, mockUsers);

type DataStoreV2 = {
	users: User[];
	teams: Team[];
	labels: TaskLabel[];
	tasks: Task[];
	competitions: Competition[];

	getTasksFlat: () => Task[];
	getTaskChildren: (parentTaskId: string) => Task[];
	getTaskParent: (task: Task) => Task | null;
	getSubtaskProgress: (parentTaskId: string) => { done: number; total: number };

	getUsers: () => User[];
	getTeams: () => Team[];
	getLabels: () => TaskLabel[];
	getTasks: () => Task[];
	getCompetitions: () => Competition[];
	getTaskById: (id: string) => Task | undefined;
	getCompetitionById: (id: string) => Competition | undefined;

	addTask: (
		task: Omit<
			Task,
			"id" | "identifier" | "createdAt" | "updatedAt" | "subTasks"
		>,
	) => Task;
	updateTask: (id: string, updates: Partial<Task>) => void;
	deleteTask: (id: string) => void;

	addCompetition: (
		competition: Omit<
			Competition,
			"id" | "createdAt" | "updatedAt" | "tasks" | "progressUpdates"
		>,
	) => Competition;
	updateCompetition: (id: string, updates: Partial<Competition>) => void;
	deleteCompetition: (id: string) => void;

	updateTaskStatus: (id: string, status: TaskStatus) => void;
	updateTaskPriority: (id: string, priority: TaskPriority) => void;
	updateTaskAssignee: (id: string, assignee: User | null) => void;
	updateTaskLabels: (id: string, labels: TaskLabel[]) => void;
	updateTaskOwner: (id: string, owner: Team | User | null) => void;
};

export const useDataV2 = create<DataStoreV2>((set, get) => ({
	users: mockUsers,
	teams: mockTeams,
	labels: mockLabels,
	tasks: mockTasks,
	competitions: mockCompetitions,

	getTasksFlat: () => get().tasks,

	getTaskChildren: (parentTaskId) =>
		get().tasks.filter(
			(task) =>
				task.parent?.type === "task" && task.parent.linkedId === parentTaskId,
		),

	getTaskParent: (task) => {
		if (task.parent?.type !== "task") return null;
		return get().tasks.find((t) => t.id === task.parent?.linkedId) ?? null;
	},

	getSubtaskProgress: (parentTaskId) => {
		const children = get().tasks.filter(
			(task) =>
				task.parent?.type === "task" && task.parent.linkedId === parentTaskId,
		);

		const relevant = children.filter((task) => task.status !== "cancelled");
		const done = relevant.filter((task) => task.status === "done").length;

		return {
			done,
			total: relevant.length,
		};
	},

	getUsers: () => get().users,
	getTeams: () => get().teams,
	getLabels: () => get().labels,
	getTasks: () => get().tasks,
	getCompetitions: () => get().competitions,

	getTaskById: (id: string) => {
		const findTask = (tasks: Task[]): Task | undefined => {
			for (const task of tasks) {
				if (task.id === id) return task;
				const found = findTask(task.subTasks);
				if (found) return found;
			}
			return undefined;
		};
		return findTask(get().tasks);
	},

	getCompetitionById: (id: string) =>
		get().competitions.find((c) => c.id === id),

	addTask: (taskData) => {
		const now = new Date().toISOString();
		const newTask: Task = {
			...taskData,
			id: faker.string.uuid(),
			identifier: generateTaskIdentifier(),
			subTasks: [],
			createdAt: now,
			updatedAt: now,
		};
		set((state) => ({ tasks: [...state.tasks, newTask] }));
		return newTask;
	},

	updateTask: (id, updates) => {
		const updateInList = (tasks: Task[]): Task[] =>
			tasks.map((task) =>
				task.id === id
					? { ...task, ...updates, updatedAt: new Date().toISOString() }
					: { ...task, subTasks: updateInList(task.subTasks) },
			);
		set((state) => ({ tasks: updateInList(state.tasks) }));
	},

	deleteTask: (id) => {
		const removeFromList = (tasks: Task[]): Task[] =>
			tasks
				.filter((task) => task.id !== id)
				.map((task) => ({ ...task, subTasks: removeFromList(task.subTasks) }));
		set((state) => ({ tasks: removeFromList(state.tasks) }));
	},

	addCompetition: (compData) => {
		const now = new Date().toISOString();
		const newComp: Competition = {
			...compData,
			id: faker.string.uuid(),
			tasks: [],
			progressUpdates: [],
			createdAt: now,
			updatedAt: now,
		};
		set((state) => ({ competitions: [...state.competitions, newComp] }));
		return newComp;
	},

	updateCompetition: (id, updates) => {
		set((state) => ({
			competitions: state.competitions.map((comp) =>
				comp.id === id
					? { ...comp, ...updates, updatedAt: new Date().toISOString() }
					: comp,
			),
		}));
	},

	deleteCompetition: (id) => {
		set((state) => ({
			competitions: state.competitions.filter((comp) => comp.id !== id),
		}));
	},

	updateTaskStatus: (id, status) => {
		get().updateTask(id, { status });
	},

	updateTaskPriority: (id, priority) => {
		get().updateTask(id, { priority });
	},

	updateTaskAssignee: (id, assignee) => {
		get().updateTask(id, { assignee });
	},

	updateTaskLabels: (id, labels) => {
		get().updateTask(id, { labels });
	},

	updateTaskOwner: (id, owner) => {
		get().updateTask(id, { owner });
	},
}));
