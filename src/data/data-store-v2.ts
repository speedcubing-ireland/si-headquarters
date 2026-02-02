import { identicon } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { faker } from "@faker-js/faker";
import { create } from "zustand";
import {
	type ActivityEntry,
	type ActivityType,
	type ArchivedTask,
	type Comment,
	type CommentReaction,
	type Competition,
	type CompetitionPhase,
	type CompetitionTemplate,
	DEFAULT_LABELS,
	DEFAULT_PHASES,
	type Notification,
	type NotificationAction,
	type NotificationPriority,
	type NotificationStatus,
	type NotificationType,
	type ProgressUpdate,
	type RecurringPattern,
	type Reminder,
	type ReminderStatus,
	type ReminderType,
	TASK_PRIORITY,
	TASK_STATUS,
	type Task,
	type TaskLabel,
	type TaskPriority,
	type TaskStatus,
	type TaskTemplate,
	type Team,
	type TemplateTask,
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
	const teamNames = [
		"Competitions",
		"Social Media",
		"Merchandise",
		"Finance",
		"Graphics",
	] as const;

	const teams = teamNames.map((name) => ({
		id: faker.string.uuid(),
		name,
		members: faker.helpers.arrayElements(users, { min: 2, max: 5 }),
	}));

	const teamIdx = [0, 1, 4];
	teamIdx.forEach((idx) => {
		if (!teams[idx].members.includes(users[0]))
			teams[idx].members.push(users[0]);
	});

	return teams;
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
		archivedAt: null,
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

function generateCompetition(
	users: User[],
	teams: Team[],
	template: CompetitionTemplate,
): Competition {
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
	const now = new Date();
	const nowStr = now.toISOString();

	// Generate realistic weekend dates (Saturday start)
	const compStartDate = generateRandomSaturday(30, 365);
	const year = compStartDate.getFullYear();

	// 70% chance of weekend competition (Sat-Sun), 30% chance single-day (Sat only)
	const isWeekendCompetition = faker.datatype.boolean({ probability: 0.7 });
	const compEndDate = isWeekendCompetition
		? new Date(compStartDate.getTime() + 24 * 60 * 60 * 1000) // Add 1 day for Sunday
		: compStartDate; // Same day for single-day competitions

	const nameTemplate = faker.helpers.arrayElement(competitionNames);
	let name = nameTemplate.replace("{place}", place);
	// If it's a championship template, make sure the name reflects that
	if (
		template.id === "template-championship" &&
		!name.includes("Championship")
	) {
		name = `${place} Championship`;
	}
	name = `${name} ${year}`;

	const phases = generatePhases();
	const currentPhaseIdx = faker.number.int({ min: 0, max: phases.length - 1 });
	const compStart = compStartDate.toISOString().split("T")[0];
	const compEnd = compEndDate.toISOString().split("T")[0];

	const compLead = faker.helpers.arrayElement(users);
	const leadDelegate = faker.helpers.arrayElement(users);
	const organisers = faker.helpers.arrayElements(users, { min: 2, max: 5 });

	// Determine completion scenario for this competition
	const completionScenario = faker.helpers.arrayElement<
		"on-track" | "at-risk" | "off-track"
	>(["on-track", "on-track", "on-track", "at-risk", "off-track"]);

	const progressUpdates: ProgressUpdate[] = [];
	if (faker.datatype.boolean({ probability: 0.7 })) {
		const updateCount = faker.number.int({ min: 1, max: 3 });
		for (let i = 0; i < updateCount; i++) {
			const author = faker.helpers.arrayElement(users);
			progressUpdates.push({
				id: faker.string.uuid(),
				timestamp: faker.date
					.recent({ days: 14, refDate: compStartDate })
					.toISOString(),
				postedBy: author,
				status: faker.helpers.arrayElement<ProgressUpdate["status"]>([
					"on-track",
					"at-risk",
					"off-track",
				]),
				message: faker.lorem.sentence(),
				reactions: [],
			});
		}
	}

	// Generate tasks from template
	const tasks: Task[] = [];
	for (const templateTask of template.defaultTasks) {
		// Find the phase by name
		const phase = templateTask.phase
			? phases.find((p) => p.name === templateTask.phase) || null
			: null;

		// Find owner
		let owner: Team | User | null = null;
		if (templateTask.ownerType === "team" && templateTask.ownerId) {
			owner = teams.find((t) => t.id === templateTask.ownerId) || null;
		}

		// Determine assignee - use suggested assignee if available, otherwise assign from team
		let assignee: User | null = null;
		if (templateTask.suggestedAssigneeId) {
			assignee =
				users.find((u) => u.id === templateTask.suggestedAssigneeId) || null;
		} else if (owner && "members" in owner && owner.members.length > 0) {
			// Assign to a random team member
			assignee = faker.helpers.arrayElement(owner.members);
		} else if (owner && !("members" in owner)) {
			// Owner is an individual user
			assignee = owner as User;
		} else {
			// No owner - assign to a random user
			assignee = faker.helpers.arrayElement(users);
		}

		// Determine task status based on phase relationship
		let taskStatus: TaskStatus = templateTask.status;
		if (phase) {
			const taskPhaseIdx = phases.findIndex((p) => p.id === phase.id);
			if (taskPhaseIdx < currentPhaseIdx) {
				// Task is in a previous phase - should be mostly done
				const completionRate =
					completionScenario === "on-track"
						? 0.95
						: completionScenario === "at-risk"
							? 0.85
							: 0.7;
				const rand = Math.random();
				if (rand < completionRate) {
					taskStatus = "done";
				} else if (rand < completionRate + 0.15) {
					taskStatus = "awaiting-review";
				} else {
					taskStatus = "in-progress";
				}
			} else if (taskPhaseIdx === currentPhaseIdx) {
				// Task is in current phase - varied completion based on scenario
				if (completionScenario === "on-track") {
					const rand = Math.random();
					taskStatus =
						rand < 0.4
							? "in-progress"
							: rand < 0.7
								? "awaiting-review"
								: rand < 0.95
									? "done"
									: "to-do";
				} else if (completionScenario === "at-risk") {
					const rand = Math.random();
					taskStatus =
						rand < 0.3
							? "in-progress"
							: rand < 0.5
								? "to-do"
								: rand < 0.75
									? "awaiting-review"
									: rand < 0.9
										? "done"
										: "backlog";
				} else {
					// Off-track
					const rand = Math.random();
					taskStatus =
						rand < 0.4
							? "to-do"
							: rand < 0.7
								? "in-progress"
								: rand < 0.85
									? "backlog"
									: rand < 0.95
										? "awaiting-review"
										: "done";
				}
			} else {
				// Task is in future phase
				taskStatus = "backlog";
			}
		}

		// Convert label IDs to TaskLabel objects
		const taskLabels: TaskLabel[] = templateTask.labels
			.map((labelId) => mockLabels.find((l) => l.id === labelId))
			.filter((label): label is TaskLabel => label !== undefined);

		const task: Task = {
			id: faker.string.uuid(),
			identifier: generateTaskIdentifier(),
			parent: { type: "competition", linkedId: "temp" }, // Will update after comp is created
			title: templateTask.title,
			description: templateTask.description,
			owner,
			assignee,
			phase,
			status: taskStatus,
			priority: templateTask.priority,
			dueDate: null,
			requiredApprovalBy: [],
			approvedBy: [],
			labels: taskLabels,
			resources: [],
			subTasks: [],
			createdAt: nowStr,
			updatedAt: nowStr,
			archivedAt: null,
		};
		tasks.push(task);
	}

	const competition: Competition = {
		id: faker.string.uuid(),
		name,
		description: faker.lorem.sentence(),
		compStart,
		compEnd,
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
		createdAt: nowStr,
		updatedAt: nowStr,
	};

	// Update task parent references with the actual competition ID
	for (const task of tasks) {
		task.parent = { type: "competition", linkedId: competition.id };
	}

	competition.tasks = tasks;

	return competition;
}

function generateRandomSaturday(minDaysAhead = 30, maxDaysAhead = 365): Date {
	const now = new Date();
	const minDate = new Date(now);
	minDate.setDate(minDate.getDate() + minDaysAhead);
	const maxDate = new Date(now);
	maxDate.setDate(maxDate.getDate() + maxDaysAhead);

	// Generate a random date in the range
	const randomTime =
		minDate.getTime() + Math.random() * (maxDate.getTime() - minDate.getTime());
	const randomDate = new Date(randomTime);

	// Find the next Saturday (6 = Saturday)
	const dayOfWeek = randomDate.getDay();
	const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
	randomDate.setDate(randomDate.getDate() + daysUntilSaturday);

	return randomDate;
}

function generateCompetitions(
	count: number,
	users: User[],
	teams: Team[],
): Competition[] {
	const templates: CompetitionTemplate[] = [
		createStandardCompetitionTemplate(teams),
		createChampionshipTemplate(teams),
	];

	return Array.from({ length: count }, () => {
		const template = faker.helpers.arrayElement(templates);
		return generateCompetition(users, teams, template);
	});
}

function generateComments(tasks: Task[], users: User[]): Comment[] {
	const comments: Comment[] = [];

	// Generate 2-5 comments per task
	for (const task of tasks.slice(0, Math.floor(tasks.length * 0.7))) {
		const commentCount = faker.number.int({ min: 2, max: 5 });

		for (let i = 0; i < commentCount; i++) {
			const comment: Comment = {
				id: faker.string.uuid(),
				parentType: "task",
				parentId: task.id,
				parentCommentId: null,
				author: faker.helpers.arrayElement(users),
				content: faker.lorem.paragraphs({ min: 1, max: 2 }),
				createdAt: faker.date.recent({ days: 30 }).toISOString(),
				updatedAt: faker.date.recent({ days: 7 }).toISOString(),
				reactions: [],
			};
			comments.push(comment);

			// Add replies to 30% of comments
			if (faker.datatype.boolean({ probability: 0.3 })) {
				const replyCount = faker.number.int({ min: 1, max: 3 });
				for (let j = 0; j < replyCount; j++) {
					const reply: Comment = {
						id: faker.string.uuid(),
						parentType: "task",
						parentId: task.id,
						parentCommentId: comment.id,
						author: faker.helpers.arrayElement(users),
						content: faker.lorem.sentence(),
						createdAt: faker.date.recent({ days: 7 }).toISOString(),
						updatedAt: faker.date.recent({ days: 1 }).toISOString(),
						reactions: [],
					};
					comments.push(reply);
				}
			}

			// Add reactions to 40% of comments
			if (faker.datatype.boolean({ probability: 0.4 })) {
				const reactions: CommentReaction[] = [
					{
						emoji: "👍",
						users: faker.helpers.arrayElements(users, { min: 1, max: 3 }),
					},
					{
						emoji: "🔥",
						users: faker.helpers.arrayElements(users, { min: 0, max: 2 }),
					},
					{
						emoji: "🎉",
						users: faker.helpers.arrayElements(users, { min: 0, max: 1 }),
					},
				].filter((r) => r.users.length > 0);
				comment.reactions = reactions;
			}
		}
	}

	return comments;
}

function generateActivityLog(tasks: Task[], users: User[]): ActivityEntry[] {
	const activities: ActivityEntry[] = [];
	const activityTypes: ActivityType[] = [
		"created",
		"updated",
		"status_changed",
		"priority_changed",
		"assignee_changed",
		"due_date_changed",
		"label_added",
		"label_removed",
		"archived",
	];

	for (const task of tasks) {
		const activityCount = faker.number.int({ min: 1, max: 5 });

		for (let i = 0; i < activityCount; i++) {
			const type = faker.helpers.arrayElement(activityTypes);
			const actor = faker.helpers.arrayElement(users);

			const activity: ActivityEntry = {
				id: faker.string.uuid(),
				entityType: "task",
				entityId: task.id,
				type,
				actor,
				timestamp: faker.date.recent({ days: 30 }).toISOString(),
			};

			if (type === "status_changed") {
				activity.oldValue = faker.helpers.arrayElement([...TASK_STATUS]);
				activity.newValue = faker.helpers.arrayElement([...TASK_STATUS]);
			} else if (type === "priority_changed") {
				activity.oldValue = faker.helpers.arrayElement([...TASK_PRIORITY]);
				activity.newValue = faker.helpers.arrayElement([...TASK_PRIORITY]);
			} else if (type === "assignee_changed") {
				activity.oldValue = faker.helpers.arrayElement(users).name;
				activity.newValue = faker.helpers.arrayElement(users).name;
			}

			activities.push(activity);
		}
	}

	return activities.sort(
		(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);
}

// Get team by name helper
function getTeamByName(teams: Team[], name: string): Team | null {
	return teams.find((t) => t.name === name) || null;
}

// Default Competition Templates
function createStandardCompetitionTemplate(teams: Team[]): CompetitionTemplate {
	const financeTeam = getTeamByName(teams, "Finance");
	const competitionsTeam = getTeamByName(teams, "Competitions");
	const socialMediaTeam = getTeamByName(teams, "Social Media");
	const graphicsTeam = getTeamByName(teams, "Graphics");

	const defaultTasks: TemplateTask[] = [
		// Pre-Announcement phase tasks
		{
			title: "Budget Approval",
			description: "Review and approve competition budget",
			status: "to-do",
			priority: "high",
			labels: ["label-budget", "label-5"],
			ownerType: financeTeam ? "team" : null,
			ownerId: financeTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Announcement",
		},
		{
			title: "Venue Booking",
			description: "Confirm and book competition venue",
			status: "to-do",
			priority: "high",
			labels: ["label-venue", "label-5"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Announcement",
		},
		{
			title: "Sponsorship",
			description: "Secure sponsors for the competition",
			status: "to-do",
			priority: "medium",
			labels: ["label-sponsors"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Announcement",
		},
		// Post-Announcement phase tasks
		{
			title: "Social Media Promotion",
			description: "Create and schedule social media posts",
			status: "to-do",
			priority: "medium",
			labels: ["label-marketing"],
			ownerType: socialMediaTeam ? "team" : null,
			ownerId: socialMediaTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Announcement",
		},
		{
			title: "Certificates designed",
			description: "Design competition certificates",
			status: "to-do",
			priority: "medium",
			labels: ["label-design"],
			ownerType: graphicsTeam ? "team" : null,
			ownerId: graphicsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Announcement",
		},
		// Pre-Competition phase tasks
		{
			title: "Waiting list emailed and refunded",
			description: "Process waiting list and send refund emails",
			status: "to-do",
			priority: "high",
			labels: ["label-registration", "label-logistics"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Competition",
		},
		{
			title: "Pre-comp email sent",
			description: "Send pre-competition information email to competitors",
			status: "to-do",
			priority: "high",
			labels: ["label-logistics", "label-5"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Competition",
		},
		{
			title: "Check in sheet prepared",
			description: "Prepare check-in sheets for competition day",
			status: "to-do",
			priority: "medium",
			labels: ["label-logistics"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Competition",
		},
		// Post-Competition phase tasks
		{
			title: "Podium photos",
			description: "Take and post podium photos",
			status: "to-do",
			priority: "medium",
			labels: ["label-marketing"],
			ownerType: socialMediaTeam ? "team" : null,
			ownerId: socialMediaTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Competition",
		},
		{
			title: "Budget closed out",
			description: "Close out competition budget and reconcile expenses",
			status: "to-do",
			priority: "high",
			labels: ["label-budget", "label-5"],
			ownerType: financeTeam ? "team" : null,
			ownerId: financeTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Competition",
		},
	];

	return {
		id: "template-standard-competition",
		name: "Standard Competition",
		description:
			"Default template for standard competitions with essential tasks",
		icon: "🏆",
		defaultTasks,
	};
}

function createChampionshipTemplate(teams: Team[]): CompetitionTemplate {
	const financeTeam = getTeamByName(teams, "Finance");
	const competitionsTeam = getTeamByName(teams, "Competitions");
	const socialMediaTeam = getTeamByName(teams, "Social Media");
	const graphicsTeam = getTeamByName(teams, "Graphics");

	const defaultTasks: TemplateTask[] = [
		// Pre-Announcement phase tasks
		{
			title: "Budget Approval",
			description: "Review and approve championship budget",
			status: "to-do",
			priority: "urgent",
			labels: ["label-budget", "label-5"],
			ownerType: financeTeam ? "team" : null,
			ownerId: financeTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Announcement",
		},
		{
			title: "Venue Booking",
			description: "Confirm and book large championship venue",
			status: "to-do",
			priority: "urgent",
			labels: ["label-venue", "label-5"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Announcement",
		},
		{
			title: "Sponsorship Package",
			description: "Secure major sponsors for championship",
			status: "to-do",
			priority: "high",
			labels: ["label-sponsors"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Announcement",
		},
		{
			title: "Hotel Partnerships",
			description: "Negotiate hotel rates for out-of-town competitors",
			status: "to-do",
			priority: "medium",
			labels: ["label-venue", "label-sponsors"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Announcement",
		},
		{
			title: "WCA Approval",
			description: "Submit and obtain WCA approval for championship",
			status: "to-do",
			priority: "urgent",
			labels: ["label-wca", "label-5"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Announcement",
		},
		// Post-Announcement phase tasks
		{
			title: "Social Media Campaign",
			description: "Launch comprehensive social media campaign",
			status: "to-do",
			priority: "high",
			labels: ["label-marketing"],
			ownerType: socialMediaTeam ? "team" : null,
			ownerId: socialMediaTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Announcement",
		},
		{
			title: "Trophy Design",
			description: "Design and order championship trophies",
			status: "to-do",
			priority: "medium",
			labels: ["label-design"],
			ownerType: graphicsTeam ? "team" : null,
			ownerId: graphicsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Announcement",
		},
		{
			title: "Certificates designed",
			description: "Design championship certificates",
			status: "to-do",
			priority: "medium",
			labels: ["label-design"],
			ownerType: graphicsTeam ? "team" : null,
			ownerId: graphicsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Announcement",
		},
		{
			title: "Press Release",
			description: "Draft and distribute press release",
			status: "to-do",
			priority: "medium",
			labels: ["label-marketing"],
			ownerType: socialMediaTeam ? "team" : null,
			ownerId: socialMediaTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Announcement",
		},
		// Pre-Competition phase tasks
		{
			title: "Waiting list emailed and refunded",
			description: "Process waiting list and send refund emails",
			status: "to-do",
			priority: "high",
			labels: ["label-registration", "label-logistics"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Competition",
		},
		{
			title: "Pre-comp email sent",
			description: "Send detailed pre-competition information",
			status: "to-do",
			priority: "high",
			labels: ["label-logistics", "label-5"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Competition",
		},
		{
			title: "Check in sheet prepared",
			description: "Prepare check-in sheets",
			status: "to-do",
			priority: "medium",
			labels: ["label-logistics"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Competition",
		},
		{
			title: "Volunteer Briefing",
			description: "Brief volunteers on championship procedures",
			status: "to-do",
			priority: "medium",
			labels: ["label-logistics"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Competition",
		},
		{
			title: "Equipment Check",
			description: "Verify all equipment is ready for championship",
			status: "to-do",
			priority: "high",
			labels: ["label-logistics"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Pre-Competition",
		},
		// Post-Competition phase tasks
		{
			title: "Podium photos",
			description: "Take and post podium photos",
			status: "to-do",
			priority: "medium",
			labels: ["label-marketing"],
			ownerType: socialMediaTeam ? "team" : null,
			ownerId: socialMediaTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Competition",
		},
		{
			title: "Budget closed out",
			description: "Close out championship budget",
			status: "to-do",
			priority: "high",
			labels: ["label-budget", "label-5"],
			ownerType: financeTeam ? "team" : null,
			ownerId: financeTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Competition",
		},
		{
			title: "Results Submission",
			description: "Submit results to WCA",
			status: "to-do",
			priority: "urgent",
			labels: ["label-wca", "label-5"],
			ownerType: competitionsTeam ? "team" : null,
			ownerId: competitionsTeam?.id || null,
			suggestedAssigneeId: null,
			phase: "Post-Competition",
		},
	];

	return {
		id: "template-championship",
		name: "Championship",
		description:
			"Comprehensive template for championship competitions with extended tasks",
		icon: "👑",
		defaultTasks,
	};
}

// Default Task Templates
function createTaskTemplates(): TaskTemplate[] {
	return [
		{
			id: "template-task-social-media",
			name: "Social Media Post",
			description: "Template for creating social media posts",
			icon: "📱",
			title: "Social Media: {event}",
			descriptionTemplate:
				"Create and schedule social media post for {event}. Include relevant hashtags and competition details.",
			status: "to-do",
			priority: "medium",
			labels: [],
		},
		{
			id: "template-task-certificate",
			name: "Certificate Design",
			description: "Template for designing certificates",
			icon: "📜",
			title: "Design Certificates",
			descriptionTemplate:
				"Design participation and winner certificates for the competition. Ensure they match the event branding.",
			status: "to-do",
			priority: "medium",
			labels: [],
		},
		{
			id: "template-task-venue",
			name: "Venue Booking",
			description: "Template for booking competition venues",
			icon: "🏢",
			title: "Book Venue",
			descriptionTemplate:
				"Contact and confirm venue booking for the competition. Verify capacity, accessibility, and equipment availability.",
			status: "to-do",
			priority: "high",
			labels: [],
		},
	];
}

// ============================================================================
// NOTIFICATION & REMINDER GENERATION
// ============================================================================

/**
 * Generates realistic demo notifications for a user
 * BACKEND INTEGRATION NOTE: In production, notifications are created by:
 * 1. Event triggers (task updates, assignments) via webhooks
 * 2. Scheduled jobs checking due dates
 * 3. Real-time WebSocket pushes from backend
 */
function generateNotifications(
	userId: string,
	users: User[],
	tasks: Task[],
	competitions: Competition[],
	comments: Comment[],
): Notification[] {
	const notifications: Notification[] = [];
	const now = new Date();

	const notificationTemplates: Array<{
		type: NotificationType;
		title: string;
		message: string;
		entityType: "task" | "competition" | "comment" | "user" | "reminder";
		priority: NotificationPriority;
	}> = [
		{
			type: "task_assigned",
			title: "New task assigned",
			message: "You have been assigned to a new task",
			entityType: "task",
			priority: "normal",
		},
		{
			type: "task_status_changed",
			title: "Task status updated",
			message: "A task you're watching has changed status",
			entityType: "task",
			priority: "normal",
		},
		{
			type: "due_date_approaching",
			title: "Due date approaching",
			message: "A task is due soon",
			entityType: "task",
			priority: "high",
		},
		{
			type: "due_date_overdue",
			title: "Task overdue",
			message: "A task has passed its due date",
			entityType: "task",
			priority: "urgent",
		},
		{
			type: "comment_added",
			title: "New comment",
			message: "Someone commented on a task",
			entityType: "comment",
			priority: "normal",
		},
		{
			type: "task_mentioned",
			title: "You were mentioned",
			message: "Someone mentioned you in a comment",
			entityType: "comment",
			priority: "normal",
		},
		{
			type: "relation_blocked",
			title: "Task blocked",
			message: "A task you depend on is now blocked",
			entityType: "task",
			priority: "high",
		},
		{
			type: "relation_unblocked",
			title: "Task unblocked",
			message: "A blocker has been resolved",
			entityType: "task",
			priority: "normal",
		},
		{
			type: "competition_phase_changed",
			title: "Competition phase changed",
			message: "A competition moved to a new phase",
			entityType: "competition",
			priority: "normal",
		},
		{
			type: "progress_update_added",
			title: "Progress update",
			message: "New progress update on a competition",
			entityType: "competition",
			priority: "low",
		},
		{
			type: "reminder_triggered",
			title: "Reminder",
			message: "This is a scheduled reminder",
			entityType: "reminder",
			priority: "normal",
		},
	];

	// Generate 25 notifications
	const count = faker.number.int({ min: 20, max: 30 });

	for (let i = 0; i < count; i++) {
		const template = faker.helpers.arrayElement(notificationTemplates);
		const actor = faker.helpers.arrayElement(users);

		// Select appropriate entity based on type
		let entityId: string;
		let parentEntityId: string | undefined;

		switch (template.entityType) {
			case "task":
				entityId = faker.helpers.arrayElement(tasks).id;
				break;
			case "competition":
				entityId = faker.helpers.arrayElement(competitions).id;
				break;
			case "comment": {
				const comment = faker.helpers.arrayElement(comments);
				entityId = comment.id;
				parentEntityId = comment.parentId;
				break;
			}
			default:
				entityId = faker.helpers.arrayElement(tasks).id;
		}

		// Mix of read and unread
		const status: NotificationStatus = faker.helpers.arrayElement([
			"unread",
			"unread",
			"unread",
			"read",
			"read",
			"archived",
		]);

		// Create realistic timestamps (some recent, some older)
		const daysAgo = faker.number.int({ min: 0, max: 30 });
		const hoursAgo = faker.number.int({ min: 0, max: 23 });
		const createdAt = new Date(now);
		createdAt.setDate(createdAt.getDate() - daysAgo);
		createdAt.setHours(createdAt.getHours() - hoursAgo);

		// Read timestamp (if read)
		let readAt: string | undefined;
		if (status === "read" || status === "archived") {
			const readDate = new Date(createdAt);
			readDate.setHours(
				readDate.getHours() + faker.number.int({ min: 1, max: 24 }),
			);
			readAt = readDate.toISOString();
		}

		// Archived timestamp (if archived)
		let archivedAt: string | undefined;
		if (status === "archived") {
			const archivedDate = readAt ? new Date(readAt) : new Date(createdAt);
			archivedDate.setDate(
				archivedDate.getDate() + faker.number.int({ min: 1, max: 7 }),
			);
			archivedAt = archivedDate.toISOString();
		}

		// Build actions based on type
		const actions: NotificationAction[] = [
			{
				id: faker.string.uuid(),
				label: "View",
				type: "navigate",
				payload: { entityType: template.entityType, entityId },
			},
			{
				id: faker.string.uuid(),
				label: "Dismiss",
				type: "dismiss",
			},
		];

		if (
			template.type === "due_date_approaching" ||
			template.type === "due_date_overdue"
		) {
			actions.push({
				id: faker.string.uuid(),
				label: "Snooze",
				type: "snooze",
			});
		}

		const notification: Notification = {
			id: faker.string.uuid(),
			userId,
			type: template.type,
			priority: template.priority,
			status,
			title: template.title,
			message: template.message,
			body: faker.datatype.boolean({ probability: 0.3 })
				? faker.lorem.paragraph()
				: undefined,
			entityType: template.entityType,
			entityId,
			parentEntityId,
			metadata: {
				actorId: actor.id,
				actorName: actor.name,
				actorAvatarUrl: actor.avatarUrl,
				actions,
				// BACKEND INTEGRATION: webhook URL for external processing
				webhookUrl: `/api/webhooks/notifications/${faker.string.uuid()}`,
			},
			createdAt: createdAt.toISOString(),
			readAt,
			archivedAt,
			isBatchable: faker.datatype.boolean({ probability: 0.2 }),
		};

		notifications.push(notification);
	}

	// Sort by createdAt descending
	return notifications.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
}

/**
 * Generates realistic demo reminders for a user
 * BACKEND INTEGRATION NOTE: In production, reminders are managed by:
 * 1. Task queue system (Bull, Celery, etc.) with jobId references
 * 2. Scheduler service that polls for due reminders
 * 3. Webhook callbacks when reminders trigger
 */
function generateReminders(userId: string, tasks: Task[]): Reminder[] {
	const reminders: Reminder[] = [];
	const now = new Date();

	// Generate 5-10 reminders
	const count = faker.number.int({ min: 5, max: 10 });

	for (let i = 0; i < count; i++) {
		const type: ReminderType = faker.datatype.boolean({ probability: 0.3 })
			? "recurring"
			: "one_time";

		const task = faker.helpers.arrayElement(tasks);

		// Due date varies - some past (triggered), some future (pending)
		const daysOffset = faker.number.int({ min: -5, max: 14 });
		const hoursOffset = faker.number.int({ min: 0, max: 23 });
		const remindAt = new Date(now);
		remindAt.setDate(remindAt.getDate() + daysOffset);
		remindAt.setHours(hoursOffset, 0, 0, 0);

		// Determine status based on remindAt
		let status: ReminderStatus;
		let triggeredAt: string | undefined;
		let dismissedAt: string | undefined;

		if (remindAt < now) {
			// Past due
			status = faker.helpers.arrayElement([
				"triggered",
				"dismissed",
				"completed",
			]);
			if (status === "triggered") {
				triggeredAt = remindAt.toISOString();
			} else if (status === "dismissed") {
				triggeredAt = remindAt.toISOString();
				const dismissedDate = new Date(remindAt);
				dismissedDate.setHours(
					dismissedDate.getHours() + faker.number.int({ min: 1, max: 12 }),
				);
				dismissedAt = dismissedDate.toISOString();
			}
		} else {
			status = "pending";
		}

		// Recurring pattern (if recurring)
		let recurringPattern: RecurringPattern | undefined;
		let recurringConfig: Reminder["recurringConfig"] | undefined;
		let endDate: string | undefined;

		if (type === "recurring") {
			recurringPattern = faker.helpers.arrayElement([
				"daily",
				"weekly",
				"monthly",
			]);

			if (recurringPattern === "weekly") {
				recurringConfig = {
					daysOfWeek: faker.helpers.arrayElements([0, 1, 2, 3, 4, 5, 6], {
						min: 1,
						max: 3,
					}),
				};
			} else if (recurringPattern === "monthly") {
				recurringConfig = {
					dayOfMonth: faker.number.int({ min: 1, max: 28 }),
				};
			}

			// End date for recurring reminders
			if (faker.datatype.boolean({ probability: 0.5 })) {
				const end = new Date(remindAt);
				end.setMonth(end.getMonth() + faker.number.int({ min: 1, max: 6 }));
				endDate = end.toISOString().split("T")[0];
			}
		}

		const createdAt = new Date(remindAt);
		createdAt.setDate(
			createdAt.getDate() - faker.number.int({ min: 1, max: 30 }),
		);

		const reminder: Reminder = {
			id: faker.string.uuid(),
			userId,
			entityType: "task",
			entityId: task.id,
			type,
			remindAt: remindAt.toISOString(),
			recurringPattern,
			recurringConfig,
			endDate,
			status,
			triggeredAt,
			dismissedAt,
			message: faker.datatype.boolean({ probability: 0.5 })
				? faker.lorem.sentence()
				: undefined,
			priority: faker.helpers.arrayElement(["low", "normal", "high", "urgent"]),
			metadata: {
				// BACKEND INTEGRATION: jobId references the task queue job
				jobId: `reminder-job-${faker.string.alphanumeric(16)}`,
				// BACKEND INTEGRATION: webhook for external schedulers
				webhookUrl: `/api/webhooks/reminders/${faker.string.uuid()}`,
				retryCount: 0,
			},
			createdAt: createdAt.toISOString(),
			updatedAt: createdAt.toISOString(),
		};

		reminders.push(reminder);
	}

	// Sort by remindAt
	return reminders.sort(
		(a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime(),
	);
}

// ============================================================================
// MOCK DATA INITIALIZATION
// ============================================================================

const mockUsers = generateUsers(50);
const mockTeams = generateTeams(mockUsers, 3);
const mockLabels = [...DEFAULT_LABELS];
let mockTasks = flattenTasks(
	generateTasks(40, mockUsers, mockTeams, mockLabels),
);
const mockCompetitions = generateCompetitions(30, mockUsers, mockTeams);

// Extract tasks from competitions and add to global task list
// This mirrors the pattern in createCompetitionFromTemplate()
const competitionTasks = mockCompetitions.flatMap((comp) => comp.tasks);
mockTasks = [...mockTasks, ...competitionTasks];

const mockComments = generateComments(mockTasks, mockUsers);
const mockActivityLog = generateActivityLog(mockTasks, mockUsers);

// Initialize templates
const mockCompetitionTemplates: CompetitionTemplate[] = [
	createStandardCompetitionTemplate(mockTeams),
	createChampionshipTemplate(mockTeams),
];
const mockTaskTemplates: TaskTemplate[] = createTaskTemplates();

// Generate demo notifications and reminders for the first user
const demoUserId = mockUsers[0].id;
const mockNotifications = generateNotifications(
	demoUserId,
	mockUsers,
	mockTasks,
	mockCompetitions,
	mockComments,
);
const mockReminders = generateReminders(demoUserId, mockTasks);

// ============================================================================
// DATA STORE TYPE DEFINITION
// ============================================================================

type DataStoreV2 = {
	// Core entities
	users: User[];
	teams: Team[];
	labels: TaskLabel[];
	tasks: Task[];
	archivedTasks: ArchivedTask[];
	competitions: Competition[];
	comments: Comment[];
	activityLog: ActivityEntry[];
	competitionTemplates: CompetitionTemplate[];
	taskTemplates: TaskTemplate[];

	// Notifications & Reminders
	notifications: Notification[];
	reminders: Reminder[];

	// Task hierarchy methods
	getTasksFlat: () => Task[];
	getTaskChildren: (parentTaskId: string) => Task[];
	getTaskParent: (task: Task) => Task | null;
	getSubtaskProgress: (parentTaskId: string) => { done: number; total: number };

	// Getters
	getUsers: () => User[];
	getTeams: () => Team[];
	getLabels: () => TaskLabel[];

	// Label CRUD
	createLabel: (name: string, color: string) => TaskLabel;
	updateLabel: (id: string, updates: Partial<TaskLabel>) => void;
	deleteLabel: (id: string) => void;

	getTasks: (includeArchived?: boolean) => Task[];
	getArchivedTasks: () => ArchivedTask[];
	getCompetitions: () => Competition[];
	getTaskById: (id: string) => Task | undefined;
	getCompetitionById: (id: string) => Competition | undefined;

	// Task CRUD
	addTask: (
		task: Omit<
			Task,
			| "id"
			| "identifier"
			| "createdAt"
			| "updatedAt"
			| "subTasks"
			| "archivedAt"
		>,
	) => Task;
	updateTask: (id: string, updates: Partial<Task>, actor?: User) => void;
	deleteTask: (id: string, actor?: User) => void;
	deleteTasks: (taskIds: string[], actor?: User) => void;
	archiveTasks: (taskIds: string[], actor?: User) => void;
	unarchiveTask: (id: string, actor?: User) => void;
	bulkUnarchiveTasks: (taskIds: string[], actor?: User) => void;
	permanentlyDeleteTasks: (taskIds: string[]) => void;

	// Competition CRUD
	addCompetition: (
		competition: Omit<
			Competition,
			"id" | "createdAt" | "updatedAt" | "tasks" | "progressUpdates"
		>,
	) => Competition;
	updateCompetition: (id: string, updates: Partial<Competition>) => void;
	deleteCompetition: (id: string) => void;

	// Task updates
	updateTaskStatus: (id: string, status: TaskStatus, actor?: User) => void;
	updateTaskPriority: (
		id: string,
		priority: TaskPriority,
		actor?: User,
	) => void;
	updateTaskAssignee: (id: string, assignee: User | null, actor?: User) => void;
	updateTaskLabels: (id: string, labels: TaskLabel[], actor?: User) => void;
	updateTaskOwner: (
		id: string,
		owner: Team | User | null,
		actor?: User,
	) => void;

	// Comments
	getCommentsForTask: (entityType: "task", entityId: string) => Comment[];
	getCommentsForUpdate: (updateId: string) => Comment[];
	addComment: (
		parentType: "task" | "update",
		parentId: string,
		content: string,
		parentCommentId?: string,
		actor?: User,
	) => Comment;
	editComment: (commentId: string, content: string, actor?: User) => void;
	deleteComment: (commentId: string, actor?: User) => void;
	addReaction: (commentId: string, emoji: string, actor?: User) => void;
	addUpdateReaction: (
		competitionId: string,
		updateId: string,
		emoji: string,
		actor?: User,
	) => void;

	// Activity
	logActivity: (entry: Omit<ActivityEntry, "id" | "timestamp">) => void;
	getActivityForTask: (entityType: "task", entityId: string) => ActivityEntry[];
	getActivityForUpdate: (updateId: string) => ActivityEntry[];

	// Templates
	getCompetitionTemplates: () => CompetitionTemplate[];
	getTaskTemplates: () => TaskTemplate[];
	createCompetitionFromTemplate: (
		templateId: string,
		overrides: Partial<Competition>,
	) => Competition;
	createTaskFromTemplate: (
		templateId: string,
		overrides: Partial<Task>,
	) => Task;

	// ============================================================================
	// NOTIFICATION METHODS
	// ============================================================================

	/**
	 * Get all notifications for a specific user
	 * BACKEND INTEGRATION: In production, this would fetch from API:
	 * GET /api/users/{userId}/notifications
	 */
	getNotifications: (userId: string) => Notification[];

	/**
	 * Get count of unread notifications for a user
	 * BACKEND INTEGRATION: Consider caching this or using a separate endpoint:
	 * GET /api/users/{userId}/notifications/unread-count
	 */
	getUnreadCount: (userId: string) => number;

	/**
	 * Mark a single notification as read
	 * BACKEND INTEGRATION: PATCH /api/notifications/{notificationId}
	 * Body: { status: "read", readAt: timestamp }
	 * This would also trigger webhook callbacks to external systems
	 */
	markNotificationRead: (notificationId: string) => void;

	/**
	 * Mark a notification as archived
	 * BACKEND INTEGRATION: PATCH /api/notifications/{notificationId}
	 * Body: { status: "archived", archivedAt: timestamp }
	 */
	markNotificationArchived: (notificationId: string) => void;

	/**
	 * Mark all notifications as read for a user
	 * BACKEND INTEGRATION: POST /api/users/{userId}/notifications/mark-all-read
	 * This is a batch operation that should be transactional
	 */
	markAllNotificationsRead: (userId: string) => void;

	/**
	 * Create a new notification (for demo/testing)
	 * BACKEND INTEGRATION: In production, notifications are created by:
	 * - Event handlers responding to task/competition changes
	 - Webhook processors
	 * - Scheduled jobs (for due date reminders)
	 * 
	 * Example backend flow:
	 * 1. Task is assigned to user
	 * 2. Event handler creates notification record
	 * 3. WebSocket pushes to user's connected clients
	 * 4. Webhook POST to external systems (Slack, email service)
	 */
	createNotification: (
		notification: Omit<Notification, "id" | "createdAt">,
	) => Notification;

	/**
	 * Dismiss a notification (mark read + archived)
	 * BACKEND INTEGRATION: PATCH /api/notifications/{notificationId}
	 * Body: { status: "archived", readAt, archivedAt }
	 */
	dismissNotification: (notificationId: string) => void;

	// ============================================================================
	// REMINDER METHODS
	// ============================================================================

	/**
	 * Get all reminders for a user
	 * BACKEND INTEGRATION: GET /api/users/{userId}/reminders
	 */
	getReminders: (userId: string) => Reminder[];

	/**
	 * Get pending (not yet triggered) reminders for a user
	 * BACKEND INTEGRATION: GET /api/users/{userId}/reminders?status=pending
	 */
	getPendingReminders: (userId: string) => Reminder[];

	/**
	 * Set a new reminder
	 * BACKEND INTEGRATION: POST /api/reminders
	 *
	 * Backend implementation would:
	 * 1. Create reminder record in database
	 * 2. Schedule job in task queue (Bull, Celery, etc.)
	 * 3. Store jobId in reminder.metadata.jobId for tracking
	 * 4. Set up webhook callbacks for external schedulers
	 *
	 * Example with Bull queue:
	 * const job = await reminderQueue.add('process-reminder',
	 *   { reminderId: newReminder.id },
	 *   { delay: calculateDelay(newReminder.remindAt) }
	 * );
	 * newReminder.metadata.jobId = job.id;
	 */
	setReminder: (
		reminder: Omit<Reminder, "id" | "createdAt" | "updatedAt">,
	) => Reminder;

	/**
	 * Cancel a reminder (removes pending job)
	 * BACKEND INTEGRATION: DELETE /api/reminders/{reminderId}
	 *
	 * Backend would:
	 * 1. Look up jobId from reminder metadata
	 * 2. Remove job from queue: await queue.removeJob(jobId)
	 * 3. Delete reminder record or mark as cancelled
	 */
	cancelReminder: (reminderId: string) => void;

	/**
	 * Dismiss a triggered reminder
	 * BACKEND INTEGRATION: PATCH /api/reminders/{reminderId}
	 * Body: { status: "dismissed", dismissedAt: timestamp }
	 */
	dismissReminder: (reminderId: string) => void;

	/**
	 * Snooze a reminder to trigger later
	 * BACKEND INTEGRATION: PATCH /api/reminders/{reminderId}/snooze
	 * Body: { snoozeUntil: ISOString }
	 *
	 * Backend would:
	 * 1. Update remindAt timestamp
	 * 2. Reschedule the job in the queue
	 * 3. Reset status to "pending"
	 */
	snoozeReminder: (reminderId: string, snoozeUntil: string) => void;

	/**
	 * Check and trigger any reminders that should fire now
	 * BACKEND INTEGRATION: This is typically handled by a scheduled job or worker:
	 *
	 * // Worker job that runs every minute
	 * cron.schedule('* * * * *', async () => {
	 *   const dueReminders = await db.reminders.findDue();
	 *   for (const reminder of dueReminders) {
	 *     await processReminder(reminder);
	 *   }
	 * });
	 *
	 * Or with a task queue (Bull, BullMQ):
	 * queue.process('process-reminder', async (job) => {
	 *   const reminder = await db.reminders.findById(job.data.reminderId);
	 *   await triggerNotification(reminder);
	 *   await handleRecurring(reminder); // If recurring, schedule next
	 * });
	 */
	checkAndTriggerReminders: () => void;

	// ============================================================================
	// APPROVAL METHODS
	// ============================================================================

	/**
	 * Add a required approver (team or user) to a task
	 */
	addRequiredApprover: (
		taskId: string,
		approver: Team | User,
		actor?: User,
	) => void;

	/**
	 * Remove a required approver from a task
	 */
	removeRequiredApprover: (
		taskId: string,
		approverId: string,
		actor?: User,
	) => void;

	/**
	 * Approve a task (adds actor to approvedBy)
	 */
	approveTask: (taskId: string, actor: User) => void;

	/**
	 * Unapprove a task (removes actor from approvedBy)
	 */
	unapproveTask: (taskId: string, actor: User) => void;

	/**
	 * Check if all required approvals are met for a task
	 */
	isTaskFullyApproved: (taskId: string) => boolean;

	/**
	 * Get approval status for a task
	 */
	getApprovalStatus: (taskId: string) => {
		requiredCount: number;
		approvedCount: number;
		isFullyApproved: boolean;
		requiredApprovers: (Team | User)[];
		approvedBy: (Team | User)[];
		pendingApprovers: (Team | User)[];
	} | null;

	// Reset all demo data (keep templates, 13 users, and teams)
	resetDemoData: () => void;
};

// ============================================================================
// DATA STORE IMPLEMENTATION
// ============================================================================

export const useDataV2 = create<DataStoreV2>((set, get) => ({
	// Core entities
	users: mockUsers,
	teams: mockTeams,
	labels: mockLabels,
	tasks: mockTasks,
	archivedTasks: [],
	competitions: mockCompetitions,
	comments: mockComments,
	activityLog: mockActivityLog,
	competitionTemplates: mockCompetitionTemplates,
	taskTemplates: mockTaskTemplates,

	// Notifications & Reminders
	notifications: mockNotifications,
	reminders: mockReminders,

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

	createLabel: (name, color) => {
		const newLabel: TaskLabel = {
			id: faker.string.uuid(),
			name,
			color,
		};
		set((state) => ({ labels: [...state.labels, newLabel] }));
		return newLabel;
	},

	updateLabel: (id, updates) => {
		const now = new Date().toISOString();
		const previousLabel = get().labels.find((l) => l.id === id);

		// Update the label in the labels array
		set((state) => ({
			labels: state.labels.map((label) =>
				label.id === id ? { ...label, ...updates } : label,
			),
		}));

		// Update any tasks that use this label
		if (previousLabel) {
			const updateLabelsInTasks = (tasks: Task[]): Task[] =>
				tasks.map((task) => ({
					...task,
					labels: task.labels.map((label) =>
						label.id === id ? { ...label, ...updates } : label,
					),
					subTasks: updateLabelsInTasks(task.subTasks),
					updatedAt: now,
				}));

			set((state) => ({ tasks: updateLabelsInTasks(state.tasks) }));
		}
	},

	deleteLabel: (id) => {
		const now = new Date().toISOString();

		// Remove the label from the labels array
		set((state) => ({
			labels: state.labels.filter((label) => label.id !== id),
		}));

		// Remove the label from any tasks that use it
		const removeLabelFromTasks = (tasks: Task[]): Task[] =>
			tasks.map((task) => ({
				...task,
				labels: task.labels.filter((label) => label.id !== id),
				subTasks: removeLabelFromTasks(task.subTasks),
				updatedAt: now,
			}));

		set((state) => ({ tasks: removeLabelFromTasks(state.tasks) }));
	},

	getTasks: (includeArchived = false) => {
		const allTasks = get().tasks;
		if (includeArchived) return allTasks;
		return allTasks.filter((task) => task.archivedAt === null);
	},
	getArchivedTasks: () => get().archivedTasks,
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
			archivedAt: null,
		};
		set((state) => ({ tasks: [...state.tasks, newTask] }));

		// BACKEND INTEGRATION: Create notifications for task assignment
		// If task has assignee, create notification
		if (newTask.assignee) {
			console.log(
				`[BACKEND HOOK] Would create notification for task assignment to user ${newTask.assignee.id}`,
			);
			console.log(`[BACKEND HOOK] POST /api/notifications`);
			console.log(
				`[BACKEND HOOK] WebSocket push to user ${newTask.assignee.id}`,
			);
		}

		// Log activity
		get().logActivity({
			entityType: "task",
			entityId: newTask.id,
			type: "created",
			actor: (taskData.owner as User) || get().users[0],
		});

		return newTask;
	},

	updateTask: (id, updates, actor) => {
		const task = get().getTaskById(id);
		const previousValues: Record<string, string> = {};

		if (task) {
			if (updates.status && updates.status !== task.status) {
				previousValues.status = task.status;
			}
			if (updates.priority && updates.priority !== task.priority) {
				previousValues.priority = task.priority;
			}
		}

		const updateInList = (tasks: Task[]): Task[] =>
			tasks.map((task) =>
				task.id === id
					? { ...task, ...updates, updatedAt: new Date().toISOString() }
					: { ...task, subTasks: updateInList(task.subTasks) },
			);
		set((state) => ({ tasks: updateInList(state.tasks) }));

		// BACKEND INTEGRATION: Create notifications for status/priority changes
		if (actor && task) {
			if (previousValues.status) {
				console.log(
					`[BACKEND HOOK] Task ${id} status changed: ${previousValues.status} -> ${updates.status}`,
				);
				console.log(`[BACKEND HOOK] Would notify subscribers of task ${id}`);
				console.log(`[BACKEND HOOK] POST /api/notifications (status_change)`);
			}
			if (previousValues.priority) {
				console.log(
					`[BACKEND HOOK] Task ${id} priority changed: ${previousValues.priority} -> ${updates.priority}`,
				);
				console.log(`[BACKEND HOOK] Would notify task owner and assignee`);
			}
		}

		// Log activity for specific changes
		if (actor && task) {
			if (previousValues.status) {
				get().logActivity({
					entityType: "task",
					entityId: id,
					type: "status_changed",
					actor,
					oldValue: previousValues.status,
					newValue: updates.status,
				});
			}
			if (previousValues.priority) {
				get().logActivity({
					entityType: "task",
					entityId: id,
					type: "priority_changed",
					actor,
					oldValue: previousValues.priority,
					newValue: updates.priority,
				});
			}
			if (!previousValues.status && !previousValues.priority) {
				get().logActivity({
					entityType: "task",
					entityId: id,
					type: "updated",
					actor,
				});
			}
		}
	},

	deleteTask: (id, actor) => {
		const task = get().getTaskById(id);

		const removeFromList = (tasks: Task[]): Task[] =>
			tasks
				.filter((task) => task.id !== id)
				.map((task) => ({ ...task, subTasks: removeFromList(task.subTasks) }));
		set((state) => ({ tasks: removeFromList(state.tasks) }));

		// Log activity
		if (actor && task) {
			get().logActivity({
				entityType: "task",
				entityId: id,
				type: "updated",
				actor,
				metadata: { action: "deleted" },
			});
		}
	},

	deleteTasks: (taskIds, actor) => {
		const idSet = new Set(taskIds);

		const removeFromList = (tasks: Task[]): Task[] =>
			tasks
				.filter((task) => !idSet.has(task.id))
				.map((task) => ({ ...task, subTasks: removeFromList(task.subTasks) }));
		set((state) => ({ tasks: removeFromList(state.tasks) }));

		// Log activity for each deleted task
		if (actor) {
			taskIds.forEach((taskId) => {
				get().logActivity({
					entityType: "task",
					entityId: taskId,
					type: "updated",
					actor,
					metadata: { action: "deleted" },
				});
			});
		}
	},

	archiveTasks: (taskIds, actor) => {
		const now = new Date().toISOString();
		const idSet = new Set(taskIds);

		const collectTasksToArchive = (tasks: Task[]): Task[] => {
			const toArchive: Task[] = [];
			const seen = new Set<string>(); // Track already-collected tasks to prevent duplicates

			const visit = (taskList: Task[]) => {
				for (const task of taskList) {
					if (idSet.has(task.id) && !seen.has(task.id)) {
						seen.add(task.id);
						toArchive.push(task);
					}
					visit(task.subTasks);
				}
			};

			visit(tasks);
			return toArchive;
		};

		const removeFromList = (tasks: Task[]): Task[] =>
			tasks
				.filter((task) => !idSet.has(task.id))
				.map((task) => ({ ...task, subTasks: removeFromList(task.subTasks) }));

		set((state) => {
			const tasksToArchive = collectTasksToArchive(state.tasks);
			// Linear-style: Clear subTasks when archiving to prevent duplication in archive view
			// Both parent and subtasks appear as separate flat entries in the archive
			const archivedTasks: ArchivedTask[] = tasksToArchive.map((task) => ({
				...task,
				subTasks: [], // Clear subtasks - they are archived as separate entries
				archivedAt: now,
			}));

			return {
				tasks: removeFromList(state.tasks),
				archivedTasks: [...state.archivedTasks, ...archivedTasks],
			};
		});

		// Log activity
		if (actor) {
			taskIds.forEach((taskId) => {
				get().logActivity({
					entityType: "task",
					entityId: taskId,
					type: "archived",
					actor,
				});
			});
		}
	},

	unarchiveTask: (id, actor) => {
		set((state) => {
			const taskToRestore = state.archivedTasks.find((t) => t.id === id);
			if (!taskToRestore) return state;

			const { archivedAt, ...restoredTask } = taskToRestore;
			return {
				archivedTasks: state.archivedTasks.filter((t) => t.id !== id),
				tasks: [
					...state.tasks,
					{
						...restoredTask,
						archivedAt: null,
						updatedAt: new Date().toISOString(),
					},
				],
			};
		});

		// Log activity
		if (actor) {
			get().logActivity({
				entityType: "task",
				entityId: id,
				type: "unarchived",
				actor,
			});
		}
	},

	bulkUnarchiveTasks: (taskIds, actor) => {
		const idSet = new Set(taskIds);
		const now = new Date().toISOString();

		set((state) => {
			const tasksToRestore = state.archivedTasks.filter((t) => idSet.has(t.id));

			if (tasksToRestore.length === 0) return state;

			const restoredTasks = tasksToRestore.map((task) => {
				const { archivedAt, ...restored } = task;
				return {
					...restored,
					archivedAt: null,
					updatedAt: now,
				};
			});

			return {
				archivedTasks: state.archivedTasks.filter((t) => !idSet.has(t.id)),
				tasks: [...state.tasks, ...restoredTasks],
			};
		});

		// Log activity for each restored task
		if (actor) {
			taskIds.forEach((taskId) => {
				get().logActivity({
					entityType: "task",
					entityId: taskId,
					type: "unarchived",
					actor,
				});
			});
		}
	},

	permanentlyDeleteTasks: (taskIds) => {
		const idSet = new Set(taskIds);

		set((state) => ({
			archivedTasks: state.archivedTasks.filter((t) => !idSet.has(t.id)),
		}));

		// Note: No activity logging for permanent deletion as the task is gone
		console.log(
			`[BACKEND HOOK] Permanently deleted ${taskIds.length} tasks:`,
			taskIds,
		);
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

	updateCompetition: (id, updates) =>
		set((state) => ({
			competitions: state.competitions.map((comp) =>
				comp.id === id
					? { ...comp, ...updates, updatedAt: new Date().toISOString() }
					: comp,
			),
		})),

	deleteCompetition: (id) =>
		set((state) => ({
			competitions: state.competitions.filter((comp) => comp.id !== id),
		})),

	updateTaskStatus: (id, status, actor) => {
		const task = get().getTaskById(id);
		if (task) {
			const oldStatus = task.status;
			get().updateTask(id, { status });

			if (actor) {
				get().logActivity({
					entityType: "task",
					entityId: id,
					type: "status_changed",
					actor,
					oldValue: oldStatus,
					newValue: status,
				});
			}
		}
	},

	updateTaskPriority: (id, priority, actor) => {
		const task = get().getTaskById(id);
		if (task) {
			const oldPriority = task.priority;
			get().updateTask(id, { priority });

			if (actor) {
				get().logActivity({
					entityType: "task",
					entityId: id,
					type: "priority_changed",
					actor,
					oldValue: oldPriority,
					newValue: priority,
				});
			}
		}
	},

	updateTaskAssignee: (id, assignee, actor) => {
		const task = get().getTaskById(id);
		if (task) {
			const oldAssignee = task.assignee?.name || "Unassigned";
			get().updateTask(id, { assignee });

			// BACKEND INTEGRATION: Notify new assignee
			if (assignee && assignee.id !== task.assignee?.id) {
				console.log(`[BACKEND HOOK] Task ${id} assigned to ${assignee.name}`);
				console.log(`[BACKEND HOOK] POST /api/notifications`);
				console.log(
					`[BACKEND HOOK] Body: { type: "task_assigned", userId: "${assignee.id}", entityId: "${id}" }`,
				);
				console.log(`[BACKEND HOOK] WebSocket: push to user ${assignee.id}`);
			}

			if (actor) {
				get().logActivity({
					entityType: "task",
					entityId: id,
					type: "assignee_changed",
					actor,
					oldValue: oldAssignee,
					newValue: assignee?.name || "Unassigned",
				});
			}
		}
	},

	updateTaskLabels: (id, labels, actor) => {
		get().updateTask(id, { labels });

		if (actor) {
			get().logActivity({
				entityType: "task",
				entityId: id,
				type: "updated",
				actor,
				metadata: { field: "labels" },
			});
		}
	},

	updateTaskOwner: (id, owner, actor) => {
		get().updateTask(id, { owner });

		if (actor) {
			get().logActivity({
				entityType: "task",
				entityId: id,
				type: "updated",
				actor,
				metadata: { field: "owner" },
			});
		}
	},

	getCommentsForTask: (taskId) =>
		get().comments.filter(
			(comment) =>
				comment.parentType === "task" &&
				comment.parentId === taskId &&
				comment.parentCommentId === null,
		),

	getCommentsForUpdate: (updateId) =>
		get().comments.filter(
			(comment) =>
				comment.parentType === "update" &&
				comment.parentId === updateId &&
				comment.parentCommentId === null,
		),

	addComment: (parentType, parentId, content, parentCommentId, actor) => {
		const now = new Date().toISOString();
		const newComment: Comment = {
			id: faker.string.uuid(),
			parentType,
			parentId,
			parentCommentId: parentCommentId || null,
			author: actor || faker.helpers.arrayElement(get().users),
			content,
			createdAt: now,
			updatedAt: now,
			reactions: [],
		};

		set((state) => ({
			comments: [...state.comments, newComment],
		}));

		// BACKEND INTEGRATION: Notify entity subscribers about new comment
		if (parentType === "task") {
			const task = get().getTaskById(parentId);
			if (task) {
				console.log(`[BACKEND HOOK] New comment on task ${parentId}`);
				console.log(
					`[BACKEND HOOK] Would notify task subscribers (except author)`,
				);
				console.log(`[BACKEND HOOK] POST /api/notifications (comment_added)`);
			}
		}

		// Check for @mentions in content
		const mentionRegex = /@(\w+)/g;
		const mentions = content.match(mentionRegex);
		if (mentions) {
			mentions.forEach((mention) => {
				const username = mention.substring(1);
				console.log(`[BACKEND HOOK] Mention detected: @${username}`);
				console.log(
					`[BACKEND HOOK] POST /api/notifications (entity_mentioned)`,
				);
			});
		}

		// Log activity
		get().logActivity({
			entityType: parentType,
			entityId: parentId,
			type: "comment_added",
			actor: newComment.author,
			metadata: { commentId: newComment.id },
		});

		return newComment;
	},

	editComment: (commentId, content, actor) => {
		const now = new Date().toISOString();
		const comment = get().comments.find((c) => c.id === commentId);

		set((state) => ({
			comments: state.comments.map((c) =>
				c.id === commentId ? { ...c, content, updatedAt: now } : c,
			),
		}));

		// Log activity
		if (comment && actor) {
			get().logActivity({
				entityType: comment.parentType,
				entityId: comment.parentId,
				type: "comment_edited",
				actor,
				metadata: { commentId },
			});
		}
	},

	deleteComment: (commentId, actor) => {
		const comment = get().comments.find((c) => c.id === commentId);

		set((state) => ({
			comments: state.comments.filter((c) => c.id !== commentId),
		}));

		// Log activity
		if (comment && actor) {
			get().logActivity({
				entityType: comment.parentType,
				entityId: comment.parentId,
				type: "comment_deleted",
				actor,
				metadata: { commentId },
			});
		}
	},

	addReaction: (commentId, emoji, actor) => {
		const user = actor || faker.helpers.arrayElement(get().users);

		set((state) => ({
			comments: state.comments.map((c) => {
				if (c.id === commentId) {
					const existingReaction = c.reactions.find((r) => r.emoji === emoji);

					if (existingReaction) {
						// Toggle reaction: remove user if exists, add if not
						const userExists = existingReaction.users.some(
							(u) => u.id === user.id,
						);
						if (userExists) {
							return {
								...c,
								reactions: c.reactions
									.map((r) =>
										r.emoji === emoji
											? { ...r, users: r.users.filter((u) => u.id !== user.id) }
											: r,
									)
									.filter((r) => r.users.length > 0),
							};
						} else {
							return {
								...c,
								reactions: c.reactions.map((r) =>
									r.emoji === emoji ? { ...r, users: [...r.users, user] } : r,
								),
							};
						}
					} else {
						// Add new reaction
						return {
							...c,
							reactions: [...c.reactions, { emoji, users: [user] }],
						};
					}
				}
				return c;
			}),
		}));
	},

	addUpdateReaction: (competitionId, updateId, emoji, actor) => {
		const user = actor || faker.helpers.arrayElement(get().users);

		set((state) => ({
			competitions: state.competitions.map((comp) => {
				if (comp.id === competitionId) {
					return {
						...comp,
						progressUpdates: comp.progressUpdates.map((update) => {
							if (update.id === updateId) {
								const existingReaction = update.reactions.find(
									(r) => r.emoji === emoji,
								);

								if (existingReaction) {
									// Toggle reaction: remove user if exists, add if not
									const userExists = existingReaction.users.some(
										(u) => u.id === user.id,
									);
									if (userExists) {
										return {
											...update,
											reactions: update.reactions
												.map((r) =>
													r.emoji === emoji
														? {
																...r,
																users: r.users.filter((u) => u.id !== user.id),
															}
														: r,
												)
												.filter((r) => r.users.length > 0),
										};
									} else {
										return {
											...update,
											reactions: update.reactions.map((r) =>
												r.emoji === emoji
													? { ...r, users: [...r.users, user] }
													: r,
											),
										};
									}
								} else {
									// Add new reaction
									return {
										...update,
										reactions: [...update.reactions, { emoji, users: [user] }],
									};
								}
							}
							return update;
						}),
					};
				}
				return comp;
			}),
		}));
	},

	logActivity: (entry) => {
		const now = new Date().toISOString();
		const newEntry: ActivityEntry = {
			...entry,
			id: faker.string.uuid(),
			timestamp: now,
		};
		set((state) => ({
			activityLog: [newEntry, ...state.activityLog],
		}));
	},

	getActivityForTask: (taskId) =>
		get()
			.activityLog.filter(
				(entry) => entry.entityType === "task" && entry.entityId === taskId,
			)
			.sort(
				(a, b) =>
					new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
			),

	getActivityForUpdate: (updateId) =>
		get()
			.activityLog.filter(
				(entry) => entry.entityType === "update" && entry.entityId === updateId,
			)
			.sort(
				(a, b) =>
					new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
			),

	// Template methods implementation
	getCompetitionTemplates: () => get().competitionTemplates,

	getTaskTemplates: () => get().taskTemplates,

	createCompetitionFromTemplate: (templateId, overrides) => {
		const template = get().competitionTemplates.find(
			(t) => t.id === templateId,
		);
		if (!template) {
			throw new Error(`Competition template not found: ${templateId}`);
		}

		// Create the competition
		const now = new Date().toISOString();
		const phases = generatePhases();
		const newComp: Competition = {
			id: faker.string.uuid(),
			name: overrides.name || `${template.name} Competition`,
			description: overrides.description || template.description,
			compStart: overrides.compStart || now.split("T")[0],
			compEnd: overrides.compEnd || now.split("T")[0],
			compLead: overrides.compLead || get().users[0],
			leadDelegate: overrides.leadDelegate || null,
			organisers: overrides.organisers || [],
			phases: overrides.phases || phases,
			currentPhaseIdx: overrides.currentPhaseIdx ?? 0,
			progressUpdates: [],
			compSheet: null,
			tasks: [],
			createdAt: now,
			updatedAt: now,
		};

		// Create tasks from template
		const tasks: Task[] = [];
		for (const templateTask of template.defaultTasks) {
			// Find the phase by name
			const phase = templateTask.phase
				? newComp.phases.find((p) => p.name === templateTask.phase) || null
				: null;

			// Find owner
			let owner: Team | User | null = null;
			if (templateTask.ownerType === "team" && templateTask.ownerId) {
				owner = get().teams.find((t) => t.id === templateTask.ownerId) || null;
			}

			// Determine assignee - use suggested assignee if available, otherwise assign from team
			let assignee: User | null = null;
			if (templateTask.suggestedAssigneeId) {
				assignee =
					get().users.find((u) => u.id === templateTask.suggestedAssigneeId) ||
					null;
			} else if (owner && "members" in owner && owner.members.length > 0) {
				// Assign to first team member as default
				assignee = owner.members[0];
			} else if (owner && !("members" in owner)) {
				// Owner is an individual user
				assignee = owner as User;
			}

			// Determine task status based on phase relationship for new competition
			let taskStatus: TaskStatus = templateTask.status;
			if (phase) {
				const taskPhaseIdx = newComp.phases.findIndex((p) => p.id === phase.id);
				const currentPhaseIdx = newComp.currentPhaseIdx;

				if (taskPhaseIdx < currentPhaseIdx) {
					// Task is in a previous phase - mark as done
					taskStatus = "done";
				} else if (taskPhaseIdx > currentPhaseIdx) {
					// Task is in a future phase - mark as backlog
					taskStatus = "backlog";
				}
				// If in current phase, keep template status (typically "to-do")
			}

			// Convert label IDs to TaskLabel objects
			const taskLabels: TaskLabel[] = templateTask.labels
				.map((labelId) => get().labels.find((l) => l.id === labelId))
				.filter((label): label is TaskLabel => label !== undefined);

			const task: Task = {
				id: faker.string.uuid(),
				identifier: generateTaskIdentifier(),
				parent: { type: "competition", linkedId: newComp.id },
				title: templateTask.title,
				description: templateTask.description,
				owner,
				assignee,
				phase,
				status: taskStatus,
				priority: templateTask.priority,
				dueDate: null,
				requiredApprovalBy: [],
				approvedBy: [],
				labels: taskLabels,
				resources: [],
				subTasks: [],
				createdAt: now,
				updatedAt: now,
				archivedAt: null,
			};
			tasks.push(task);
		}

		newComp.tasks = tasks;

		// Add competition and tasks to store
		set((state) => ({
			competitions: [...state.competitions, newComp],
			tasks: [...state.tasks, ...tasks],
		}));

		return newComp;
	},

	createTaskFromTemplate: (templateId, overrides) => {
		const template = get().taskTemplates.find((t) => t.id === templateId);
		if (!template) {
			throw new Error(`Task template not found: ${templateId}`);
		}

		const now = new Date().toISOString();
		const newTask: Task = {
			id: faker.string.uuid(),
			identifier: generateTaskIdentifier(),
			parent: overrides.parent || null,
			title: overrides.title || template.title,
			description: overrides.description || template.descriptionTemplate,
			owner: overrides.owner || null,
			assignee: overrides.assignee || null,
			phase: overrides.phase || null,
			status: overrides.status || template.status,
			priority: overrides.priority || template.priority,
			dueDate: overrides.dueDate || null,
			requiredApprovalBy: overrides.requiredApprovalBy || [],
			approvedBy: overrides.approvedBy || [],
			labels: [],
			resources: [],
			subTasks: [],
			createdAt: now,
			updatedAt: now,
			archivedAt: null,
		};

		set((state) => ({ tasks: [...state.tasks, newTask] }));

		// Log activity
		get().logActivity({
			entityType: "task",
			entityId: newTask.id,
			type: "created",
			actor: (newTask.owner as User) || get().users[0],
		});

		return newTask;
	},

	// ============================================================================
	// NOTIFICATION METHODS IMPLEMENTATION
	// ============================================================================

	getNotifications: (userId) =>
		get()
			.notifications.filter((n) => n.userId === userId)
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			),

	getUnreadCount: (userId) =>
		get().notifications.filter(
			(n) => n.userId === userId && n.status === "unread",
		).length,

	markNotificationRead: (notificationId) => {
		const now = new Date().toISOString();

		set((state) => ({
			notifications: state.notifications.map((n) =>
				n.id === notificationId && n.status === "unread"
					? { ...n, status: "read" as NotificationStatus, readAt: now }
					: n,
			),
		}));

		// BACKEND INTEGRATION: Sync read status to backend
		console.log(`[BACKEND HOOK] PATCH /api/notifications/${notificationId}`);
		console.log(`[BACKEND HOOK] Body: { status: "read", readAt: "${now}" }`);
		console.log(`[BACKEND HOOK] Webhook callback to external systems`);
	},

	markNotificationArchived: (notificationId) => {
		const now = new Date().toISOString();

		set((state) => ({
			notifications: state.notifications.map((n) =>
				n.id === notificationId
					? { ...n, status: "archived" as NotificationStatus, archivedAt: now }
					: n,
			),
		}));

		// BACKEND INTEGRATION: Archive on backend
		console.log(`[BACKEND HOOK] PATCH /api/notifications/${notificationId}`);
		console.log(
			`[BACKEND HOOK] Body: { status: "archived", archivedAt: "${now}" }`,
		);
	},

	markAllNotificationsRead: (userId) => {
		const now = new Date().toISOString();

		set((state) => ({
			notifications: state.notifications.map((n) =>
				n.userId === userId && n.status === "unread"
					? { ...n, status: "read" as NotificationStatus, readAt: now }
					: n,
			),
		}));

		// BACKEND INTEGRATION: Batch update
		console.log(
			`[BACKEND HOOK] POST /api/users/${userId}/notifications/mark-all-read`,
		);
		console.log(`[BACKEND HOOK] Body: { readAt: "${now}" }`);
		console.log(`[BACKEND HOOK] This is a transactional batch operation`);
	},

	createNotification: (notification) => {
		const now = new Date().toISOString();
		const newNotification: Notification = {
			...notification,
			id: faker.string.uuid(),
			createdAt: now,
		};

		set((state) => ({
			notifications: [newNotification, ...state.notifications],
		}));

		// BACKEND INTEGRATION: Production flow example
		console.log(`[BACKEND HOOK] Production notification creation flow:`);
		console.log(`[BACKEND HOOK] 1. POST /api/notifications`);
		console.log(
			`[BACKEND HOOK] 2. WebSocket: emit to user ${notification.userId}`,
		);
		console.log(
			`[BACKEND HOOK] 3. Webhook: POST to ${notification.metadata?.webhookUrl || "/api/webhooks/notifications"}`,
		);
		console.log(`[BACKEND HOOK] 4. Push notification to mobile (if enabled)`);
		console.log(`[BACKEND HOOK] 5. Email digest (if user prefers digests)`);

		return newNotification;
	},

	dismissNotification: (notificationId) => {
		const now = new Date().toISOString();

		set((state) => ({
			notifications: state.notifications.map((n) =>
				n.id === notificationId
					? {
							...n,
							status: "archived" as NotificationStatus,
							readAt: n.readAt || now,
							archivedAt: now,
						}
					: n,
			),
		}));

		// BACKEND INTEGRATION: Dismissal
		console.log(`[BACKEND HOOK] PATCH /api/notifications/${notificationId}`);
		console.log(
			`[BACKEND HOOK] Body: { status: "archived", readAt: "${now}", archivedAt: "${now}" }`,
		);
	},

	// ============================================================================
	// REMINDER METHODS IMPLEMENTATION
	// ============================================================================

	getReminders: (userId) =>
		get()
			.reminders.filter((r) => r.userId === userId)
			.sort(
				(a, b) =>
					new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime(),
			),

	getPendingReminders: (userId) =>
		get().reminders.filter(
			(r) => r.userId === userId && r.status === "pending",
		),

	setReminder: (reminder) => {
		const now = new Date().toISOString();
		const newReminder: Reminder = {
			...reminder,
			id: faker.string.uuid(),
			createdAt: now,
			updatedAt: now,
		};

		set((state) => ({
			reminders: [...state.reminders, newReminder],
		}));

		// BACKEND INTEGRATION: Schedule reminder in task queue
		console.log(`[BACKEND HOOK] POST /api/reminders`);
		console.log(`[BACKEND HOOK] Task queue scheduling example (Bull/BullMQ):`);
		console.log(
			`[BACKEND HOOK]   const job = await reminderQueue.add('process-reminder',`,
		);
		console.log(`[BACKEND HOOK]     { reminderId: "${newReminder.id}" },`);
		console.log(
			`[BACKEND HOOK]     { delay: Date.parse("${reminder.remindAt}") - Date.now() }`,
		);
		console.log(`[BACKEND HOOK]   );`);
		console.log(`[BACKEND HOOK]   // Store jobId for tracking`);
		console.log(
			`[BACKEND HOOK]   await db.reminders.update("${newReminder.id}", { metadata: { jobId: job.id } })`,
		);

		// BACKEND INTEGRATION: External scheduler webhook
		if (reminder.metadata?.webhookUrl) {
			console.log(
				`[BACKEND HOOK] Webhook to external scheduler: POST ${reminder.metadata.webhookUrl}`,
			);
		}

		return newReminder;
	},

	cancelReminder: (reminderId) => {
		const reminder = get().reminders.find((r) => r.id === reminderId);

		set((state) => ({
			reminders: state.reminders.filter((r) => r.id !== reminderId),
		}));

		// BACKEND INTEGRATION: Cancel scheduled job
		if (reminder) {
			console.log(`[BACKEND HOOK] DELETE /api/reminders/${reminderId}`);
			console.log(`[BACKEND HOOK] Task queue cancellation example:`);
			if (reminder.metadata?.jobId) {
				console.log(
					`[BACKEND HOOK]   await reminderQueue.removeJob("${reminder.metadata.jobId}");`,
				);
			}
			console.log(`[BACKEND HOOK] Webhook cancellation to external scheduler`);
		}
	},

	dismissReminder: (reminderId) => {
		const now = new Date().toISOString();

		set((state) => ({
			reminders: state.reminders.map((r) =>
				r.id === reminderId && r.status === "triggered"
					? {
							...r,
							status: "dismissed" as ReminderStatus,
							dismissedAt: now,
							updatedAt: now,
						}
					: r,
			),
		}));

		// BACKEND INTEGRATION: Dismissal sync
		console.log(`[BACKEND HOOK] PATCH /api/reminders/${reminderId}`);
		console.log(
			`[BACKEND HOOK] Body: { status: "dismissed", dismissedAt: "${now}" }`,
		);
	},

	snoozeReminder: (reminderId, snoozeUntil) => {
		const now = new Date().toISOString();

		set((state) => ({
			reminders: state.reminders.map((r) =>
				r.id === reminderId
					? {
							...r,
							remindAt: snoozeUntil,
							status: "pending" as ReminderStatus,
							updatedAt: now,
						}
					: r,
			),
		}));

		// BACKEND INTEGRATION: Reschedule in task queue
		console.log(`[BACKEND HOOK] PATCH /api/reminders/${reminderId}/snooze`);
		console.log(`[BACKEND HOOK] Body: { snoozeUntil: "${snoozeUntil}" }`);
		console.log(`[BACKEND HOOK] Task queue rescheduling example:`);
		console.log(
			`[BACKEND HOOK]   await job.update({ delay: Date.parse("${snoozeUntil}") - Date.now() });`,
		);
	},

	checkAndTriggerReminders: () => {
		const now = new Date().toISOString();
		const nowDate = new Date();

		// Find reminders that should trigger now
		const dueReminders = get().reminders.filter(
			(r) => r.status === "pending" && new Date(r.remindAt) <= nowDate,
		);

		if (dueReminders.length > 0) {
			console.log(
				`[BACKEND HOOK] Found ${dueReminders.length} reminders to trigger`,
			);

			// Update status to triggered
			set((state) => ({
				reminders: state.reminders.map((r) =>
					dueReminders.some((d) => d.id === r.id)
						? {
								...r,
								status: "triggered" as ReminderStatus,
								triggeredAt: now,
								updatedAt: now,
							}
						: r,
				),
			}));

			// Create notifications for triggered reminders
			for (const reminder of dueReminders) {
				const notification: Omit<Notification, "id" | "createdAt"> = {
					userId: reminder.userId,
					type: "reminder_triggered",
					priority: reminder.priority,
					status: "unread",
					title: "Reminder",
					message: reminder.message || "A scheduled reminder has triggered",
					entityType: "task",
					entityId: reminder.entityId,
					metadata: {
						actions: [
							{
								id: faker.string.uuid(),
								label: "View Task",
								type: "navigate",
								payload: { entityType: "task", entityId: reminder.entityId },
							},
							{
								id: faker.string.uuid(),
								label: "Dismiss",
								type: "dismiss",
							},
						],
						webhookUrl: `/api/webhooks/reminders/${reminder.id}`,
					},
					isBatchable: false,
				};

				get().createNotification(notification);

				// Handle recurring reminders
				if (reminder.type === "recurring" && reminder.recurringPattern) {
					console.log(
						`[BACKEND HOOK] Recurring reminder ${reminder.id} - scheduling next occurrence`,
					);
					console.log(`[BACKEND HOOK] Pattern: ${reminder.recurringPattern}`);

					// Calculate next occurrence
					const nextRemindAt = new Date(reminder.remindAt);
					if (reminder.recurringPattern === "daily") {
						nextRemindAt.setDate(nextRemindAt.getDate() + 1);
					} else if (
						reminder.recurringPattern === "weekly" &&
						reminder.recurringConfig?.daysOfWeek
					) {
						nextRemindAt.setDate(nextRemindAt.getDate() + 7);
					} else if (
						reminder.recurringPattern === "monthly" &&
						reminder.recurringConfig?.dayOfMonth
					) {
						nextRemindAt.setMonth(nextRemindAt.getMonth() + 1);
					}

					// Check if we've passed the end date
					if (!reminder.endDate || nextRemindAt <= new Date(reminder.endDate)) {
						console.log(
							`[BACKEND HOOK] Scheduling next occurrence: ${nextRemindAt.toISOString()}`,
						);

						// Create new reminder for next occurrence
						const nextReminder: Omit<
							Reminder,
							"id" | "createdAt" | "updatedAt"
						> = {
							...reminder,
							remindAt: nextRemindAt.toISOString(),
							status: "pending",
							triggeredAt: undefined,
							dismissedAt: undefined,
							metadata: {
								...reminder.metadata,
								jobId: undefined, // Will be set by backend
							},
						};
						get().setReminder(nextReminder);
					} else {
						console.log(
							`[BACKEND HOOK] Recurring reminder ${reminder.id} has reached end date`,
						);
					}
				}
			}
		}

		console.log(`[BACKEND HOOK] Production implementation would use:`);
		console.log(`[BACKEND HOOK] - Scheduled job (cron) running every minute`);
		console.log(`[BACKEND HOOK] - Task queue workers (Bull/BullMQ/Celery)`);
		console.log(
			`[BACKEND HOOK] - WebSocket for real-time notification delivery`,
		);
		console.log(`[BACKEND HOOK] - Webhook callbacks for external integrations`);
	},

	// Approval methods implementation
	addRequiredApprover: (taskId, approver, actor) => {
		const task = get().getTaskById(taskId);
		if (!task) return;

		const currentApprovers = task.requiredApprovalBy || [];
		const exists = currentApprovers.some((a) => a.id === approver.id);

		if (!exists) {
			get().updateTask(taskId, {
				requiredApprovalBy: [...currentApprovers, approver],
			});
		}

		if (actor) {
			get().logActivity({
				entityType: "task",
				entityId: taskId,
				type: "updated",
				actor,
				metadata: {
					field: "requiredApprovalBy",
					action: "add",
					approverId: approver.id,
				},
			});
		}
	},

	removeRequiredApprover: (taskId, approverId, actor) => {
		const task = get().getTaskById(taskId);
		if (!task) return;

		const currentApprovers = task.requiredApprovalBy || [];
		const approvedBy = task.approvedBy || [];

		get().updateTask(taskId, {
			requiredApprovalBy: currentApprovers.filter((a) => a.id !== approverId),
			approvedBy: approvedBy.filter((a) => a.id !== approverId),
		});

		if (actor) {
			get().logActivity({
				entityType: "task",
				entityId: taskId,
				type: "updated",
				actor,
				metadata: { field: "requiredApprovalBy", action: "remove", approverId },
			});
		}
	},

	approveTask: (taskId, actor) => {
		const task = get().getTaskById(taskId);
		if (!task) return;

		const currentApproved = task.approvedBy || [];
		const exists = currentApproved.some((a) => a.id === actor.id);

		if (!exists) {
			get().updateTask(taskId, {
				approvedBy: [...currentApproved, actor],
			});
		}

		get().logActivity({
			entityType: "task",
			entityId: taskId,
			type: "updated",
			actor,
			metadata: { field: "approvedBy", action: "approve" },
		});
	},

	unapproveTask: (taskId, actor) => {
		const task = get().getTaskById(taskId);
		if (!task) return;

		const currentApproved = task.approvedBy || [];

		get().updateTask(taskId, {
			approvedBy: currentApproved.filter((a) => a.id !== actor.id),
		});

		get().logActivity({
			entityType: "task",
			entityId: taskId,
			type: "updated",
			actor,
			metadata: { field: "approvedBy", action: "unapprove" },
		});
	},

	isTaskFullyApproved: (taskId) => {
		const status = get().getApprovalStatus(taskId);
		return status?.isFullyApproved ?? false;
	},

	getApprovalStatus: (taskId) => {
		const task = get().getTaskById(taskId);
		if (!task) return null;

		const requiredApprovers = task.requiredApprovalBy || [];
		const approvedBy = task.approvedBy || [];
		const approvedIds = new Set(approvedBy.map((a) => a.id));

		const pendingApprovers = requiredApprovers.filter(
			(a) => !approvedIds.has(a.id),
		);

		return {
			requiredCount: requiredApprovers.length,
			approvedCount: approvedBy.length,
			isFullyApproved:
				requiredApprovers.length > 0 &&
				approvedBy.length >= requiredApprovers.length,
			requiredApprovers,
			approvedBy,
			pendingApprovers,
		};
	},

	resetDemoData: () => {
		// Keep only first 13 users (first user is typically the demo user)
		const usersToKeep = get().users.slice(0, 13);

		// Keep all teams but update their members to only include kept users
		const updatedTeams = get().teams.map((team) => ({
			...team,
			members: team.members.filter((member) =>
				usersToKeep.some((user) => user.id === member.id),
			),
		}));

		// Keep only default labels
		const defaultLabels = [...DEFAULT_LABELS];

		// Reset task counter
		taskCounter = 1;

		set({
			users: usersToKeep,
			teams: updatedTeams,
			labels: defaultLabels,
			tasks: [],
			archivedTasks: [],
			competitions: [],
			comments: [],
			activityLog: [],
			notifications: [],
			reminders: [],
			// Templates are kept as-is
		});
	},
}));
