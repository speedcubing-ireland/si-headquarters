import { describe, expect, test } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type {
	CompetitionPhase,
	TaskLabel,
	Team,
	TemplateTask,
	User,
} from "@/data/types-new";
import { buildTemplateCreateTaskInputs } from "./use-template-tasks";

const userId = (id: string) => id as Id<"users">;
const teamId = (id: string) => id as Id<"teams">;
const phaseId = (id: string) => id as Id<"phases">;
const labelId = (id: string) => id as Id<"labels">;

function makeUser(id: string, name: string): User {
	return {
		id: userId(id),
		name,
		avatarUrl: "",
	} as User;
}

function makeTeam(id: string, name: string, members: User[]): Team {
	return {
		id: teamId(id),
		name,
		members,
	};
}

function makePhase(id: string, name: string): CompetitionPhase {
	return {
		id: phaseId(id),
		name,
		description: "",
	};
}

function makeLabel(id: string, name: string): TaskLabel {
	return {
		id: labelId(id),
		name,
		color: "#000000",
	};
}

function makeTemplateTask(overrides: Partial<TemplateTask> = {}): TemplateTask {
	return {
		title: "Venue booked",
		description: "Book venue",
		status: "backlog",
		priority: "high",
		labels: ["Venue"],
		ownerTeamName: "Competitions Team",
		phase: "Concept",
		...overrides,
	};
}

describe("buildTemplateCreateTaskInputs", () => {
	test("does not assign first team member when suggested assignee is missing", () => {
		const alice = makeUser("user-alice", "Alice");
		const bob = makeUser("user-bob", "Bob");
		const teams = [makeTeam("team-comp", "Competitions Team", [alice, bob])];

		const tasks = buildTemplateCreateTaskInputs({
			template: { defaultTasks: [makeTemplateTask()] },
			competitionPhases: [makePhase("phase-concept", "Concept")],
			teams,
			users: [alice, bob],
			labels: [makeLabel("label-venue", "Venue")],
		});

		expect(tasks).toHaveLength(1);
		expect(tasks[0].ownerId).toBe(teams[0].id);
		expect(tasks[0]).not.toHaveProperty("assigneeId");
	});

	test("keeps explicit suggested assignee mapping", () => {
		const alice = makeUser("user-alice", "Alice");
		const bob = makeUser("user-bob", "Bob");
		const teams = [makeTeam("team-comp", "Competitions Team", [alice, bob])];

		const tasks = buildTemplateCreateTaskInputs({
			template: {
				defaultTasks: [
					makeTemplateTask({ suggestedAssigneeId: String(bob.id) }),
				],
			},
			competitionPhases: [makePhase("phase-concept", "Concept")],
			teams,
			users: [alice, bob],
			labels: [makeLabel("label-venue", "Venue")],
		});

		expect(tasks).toHaveLength(1);
		expect(tasks[0].assigneeId).toBe(bob.id);
	});

	test("passes through linked action short IDs to template create payload", () => {
		const alice = makeUser("user-alice", "Alice");
		const tasks = buildTemplateCreateTaskInputs({
			template: {
				defaultTasks: [
					makeTemplateTask({
						linkedActionShortIds: [
							"sheet.populate-checkin",
							"canva.certificates",
						],
					}),
				],
			},
			competitionPhases: [makePhase("phase-concept", "Concept")],
			teams: [makeTeam("team-comp", "Competitions Team", [alice])],
			users: [alice],
			labels: [makeLabel("label-venue", "Venue")],
		});

		expect(tasks).toHaveLength(1);
		expect(tasks[0].linkedActionShortIds).toEqual([
			"sheet.populate-checkin",
			"canva.certificates",
		]);
	});
});
