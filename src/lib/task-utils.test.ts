import { describe, expect, test } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { Competition, Task } from "@/data/types-new";
import { groupTasksByCompetitionPhase } from "./task-utils";

function makeTask(overrides: Partial<Task>): Task {
	return {
		id: "task-1" as Id<"tasks">,
		status: "to-do",
		parent: null,
		phase: null,
		...overrides,
	} as Task;
}

describe("groupTasksByCompetitionPhase", () => {
	test("includes all competition phases even when empty", () => {
		const competition = {
			phases: [
				{ id: "phase-1", name: "Concept" },
				{ id: "phase-2", name: "Pre-Announcement" },
			],
		} as Competition;

		const tasks = [
			makeTask({
				id: "task-2" as Id<"tasks">,
				phase: { id: "phase-1", name: "Concept" } as Task["phase"],
			}),
		];

		const groups = groupTasksByCompetitionPhase(tasks, competition);

		expect(groups).toHaveLength(2);
		expect(groups[0]?.phase?.id).toBe("phase-1");
		expect(groups[0]?.tasks).toHaveLength(1);
		expect(groups[1]?.phase?.id).toBe("phase-2");
		expect(groups[1]?.tasks).toHaveLength(0);
	});
});
