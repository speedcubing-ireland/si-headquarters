import { describe, expect, test } from "vitest";
import { buildTaskPatch } from "./patch";
import type { Id } from "../_generated/dataModel";

const taskId = (id: string) => id as Id<"tasks">;
const compId = (id: string) => id as Id<"competitions">;
const userId = (id: string) => id as Id<"users">;
const teamId = (id: string) => id as Id<"teams">;
const phaseId = (id: string) => id as Id<"phases">;
const labelId = (id: string) => id as Id<"labels">;

describe("buildTaskPatch", () => {
	const updatedAt = 1700000000000;

	test("returns only updatedAt for empty updates", () => {
		const result = buildTaskPatch({}, updatedAt);
		expect(result).toEqual({ updatedAt });
	});

	test("passes through simple string fields", () => {
		const result = buildTaskPatch(
			{ title: "New Title", description: "Desc" },
			updatedAt,
		);
		expect(result.title).toBe("New Title");
		expect(result.description).toBe("Desc");
		expect(result.updatedAt).toBe(updatedAt);
	});

	test("passes through status and priority", () => {
		const result = buildTaskPatch(
			{ status: "in-progress", priority: "high" },
			updatedAt,
		);
		expect(result.status).toBe("in-progress");
		expect(result.priority).toBe("high");
	});

	test("passes through labelIds array", () => {
		const ids = [labelId("l1"), labelId("l2")];
		const result = buildTaskPatch({ labelIds: ids }, updatedAt);
		expect(result.labelIds).toEqual(ids);
	});

	test("passes through ownerType", () => {
		const result = buildTaskPatch({ ownerType: "team" }, updatedAt);
		expect(result.ownerType).toBe("team");
	});

	describe("nullable fields (null → undefined conversion)", () => {
		test("converts null dueDate to undefined (field deletion)", () => {
			const result = buildTaskPatch({ dueDate: null }, updatedAt);
			expect(result.dueDate).toBeUndefined();
			expect("dueDate" in result).toBe(true);
		});

		test("passes through non-null dueDate as-is", () => {
			const result = buildTaskPatch({ dueDate: "2025-06-15" }, updatedAt);
			expect(result.dueDate).toBe("2025-06-15");
		});

		test("converts null parentTaskId to undefined", () => {
			const result = buildTaskPatch({ parentTaskId: null }, updatedAt);
			expect(result.parentTaskId).toBeUndefined();
			expect("parentTaskId" in result).toBe(true);
		});

		test("passes through non-null parentTaskId", () => {
			const id = taskId("t1");
			const result = buildTaskPatch({ parentTaskId: id }, updatedAt);
			expect(result.parentTaskId).toBe(id);
		});

		test("converts null parentCompetitionId to undefined", () => {
			const result = buildTaskPatch({ parentCompetitionId: null }, updatedAt);
			expect(result.parentCompetitionId).toBeUndefined();
			expect("parentCompetitionId" in result).toBe(true);
		});

		test("passes through non-null parentCompetitionId", () => {
			const id = compId("c1");
			const result = buildTaskPatch({ parentCompetitionId: id }, updatedAt);
			expect(result.parentCompetitionId).toBe(id);
		});

		test("converts null ownerId to undefined", () => {
			const result = buildTaskPatch({ ownerId: null }, updatedAt);
			expect(result.ownerId).toBeUndefined();
			expect("ownerId" in result).toBe(true);
		});

		test("passes through non-null ownerId (user)", () => {
			const id = userId("u1");
			const result = buildTaskPatch({ ownerId: id }, updatedAt);
			expect(result.ownerId).toBe(id);
		});

		test("passes through non-null ownerId (team)", () => {
			const id = teamId("team1");
			const result = buildTaskPatch({ ownerId: id }, updatedAt);
			expect(result.ownerId).toBe(id);
		});

		test("converts null assigneeId to undefined", () => {
			const result = buildTaskPatch({ assigneeId: null }, updatedAt);
			expect(result.assigneeId).toBeUndefined();
			expect("assigneeId" in result).toBe(true);
		});

		test("passes through non-null assigneeId", () => {
			const id = userId("u1");
			const result = buildTaskPatch({ assigneeId: id }, updatedAt);
			expect(result.assigneeId).toBe(id);
		});

		test("converts null phaseId to undefined", () => {
			const result = buildTaskPatch({ phaseId: null }, updatedAt);
			expect(result.phaseId).toBeUndefined();
			expect("phaseId" in result).toBe(true);
		});

		test("passes through non-null phaseId", () => {
			const id = phaseId("p1");
			const result = buildTaskPatch({ phaseId: id }, updatedAt);
			expect(result.phaseId).toBe(id);
		});
	});

	test("does not include fields that are not in updates", () => {
		const result = buildTaskPatch({ title: "Only title" }, updatedAt);
		expect(Object.keys(result)).toEqual(
			expect.arrayContaining(["title", "updatedAt"]),
		);
		expect("status" in result).toBe(false);
		expect("priority" in result).toBe(false);
		expect("dueDate" in result).toBe(false);
		expect("assigneeId" in result).toBe(false);
	});

	test("handles resources field", () => {
		const resources = [{ type: "google-sheet" as const, sheetId: "abc" }];
		const result = buildTaskPatch({ resources }, updatedAt);
		expect(result.resources).toEqual(resources);
	});

	test("handles all fields simultaneously", () => {
		const result = buildTaskPatch(
			{
				title: "Full update",
				description: "Everything",
				status: "done",
				priority: "urgent",
				dueDate: "2025-12-31",
				parentTaskId: null,
				parentCompetitionId: compId("c1"),
				ownerId: userId("u1"),
				ownerType: "user",
				assigneeId: userId("u2"),
				phaseId: phaseId("p1"),
				labelIds: [labelId("l1")],
				resources: [{ type: "google-sheet" as const, sheetId: "abc" }],
			},
			updatedAt,
		);

		expect(result.title).toBe("Full update");
		expect(result.description).toBe("Everything");
		expect(result.status).toBe("done");
		expect(result.priority).toBe("urgent");
		expect(result.dueDate).toBe("2025-12-31");
		expect(result.parentTaskId).toBeUndefined();
		expect(result.parentCompetitionId).toBe(compId("c1"));
		expect(result.ownerId).toBe(userId("u1"));
		expect(result.ownerType).toBe("user");
		expect(result.assigneeId).toBe(userId("u2"));
		expect(result.phaseId).toBe(phaseId("p1"));
		expect(result.labelIds).toEqual([labelId("l1")]);
		expect(result.updatedAt).toBe(updatedAt);
	});
});
