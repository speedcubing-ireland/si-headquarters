import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { computeBlockingStatusTransitionEffects } from "./taskRelations";

const taskId = (id: string) => id as Id<"tasks">;

type FakeRelation = {
	blockedTaskId: Id<"tasks">;
	blockingTaskId: Id<"tasks">;
};

function makeCtx(args: {
	relations: FakeRelation[];
	taskStatuses: Record<string, "in-progress" | "done" | "cancelled">;
}) {
	const taskStatusEntries = new Map(
		Object.entries(args.taskStatuses).map(([id, status]) => [
			taskId(id),
			status,
		]),
	);

	return {
		db: {
			query: (table: string) => {
				if (table !== "taskRelations") {
					throw new Error(`Unexpected table query: ${table}`);
				}
				return {
					withIndex: (
						_index: string,
						build: (q: {
							eq: (field: string, value: unknown) => unknown;
						}) => unknown,
					) => {
						const filters = new Map<string, unknown>();
						const indexCursor = {
							eq: (field: string, value: unknown) => {
								filters.set(field, value);
								return indexCursor;
							},
						};
						build(indexCursor);
						const rows = args.relations.filter((relation) =>
							[...filters.entries()].every(
								([field, value]) =>
									relation[field as keyof FakeRelation] === value,
							),
						);
						return {
							collect: async () => rows,
						};
					},
				};
			},
			get: async (table: string, id: Id<"tasks">) => {
				if (table !== "tasks") {
					throw new Error(`Unexpected table get: ${table}`);
				}
				const status = taskStatusEntries.get(id);
				if (!status) {
					return null;
				}
				return { _id: id, status };
			},
		},
	} as never;
}

describe("computeBlockingStatusTransitionEffects", () => {
	test("returns unblocked when the last blocker resolves", async () => {
		const blockedTaskId = taskId("task-blocked");
		const blockingTaskId = taskId("task-blocking");
		const ctx = makeCtx({
			relations: [{ blockedTaskId, blockingTaskId }],
			taskStatuses: {
				"task-blocking": "done",
			},
		});

		const effects = await computeBlockingStatusTransitionEffects(
			ctx,
			blockingTaskId,
			"in-progress",
			"done",
		);

		expect(effects).toEqual([
			{
				type: "unblocked",
				blockedTaskId,
				blockingTaskId,
			},
		]);
	});

	test("returns no effects when other unresolved blockers remain", async () => {
		const blockedTaskId = taskId("task-blocked");
		const blockingTaskId = taskId("task-blocking");
		const secondaryBlockerId = taskId("task-secondary");
		const ctx = makeCtx({
			relations: [
				{ blockedTaskId, blockingTaskId },
				{ blockedTaskId, blockingTaskId: secondaryBlockerId },
			],
			taskStatuses: {
				"task-blocking": "done",
				"task-secondary": "in-progress",
			},
		});

		const effects = await computeBlockingStatusTransitionEffects(
			ctx,
			blockingTaskId,
			"in-progress",
			"done",
		);

		expect(effects).toEqual([]);
	});

	test("returns blocked when task becomes the first unresolved blocker", async () => {
		const blockedTaskId = taskId("task-blocked");
		const blockingTaskId = taskId("task-blocking");
		const ctx = makeCtx({
			relations: [{ blockedTaskId, blockingTaskId }],
			taskStatuses: {
				"task-blocking": "in-progress",
			},
		});

		const effects = await computeBlockingStatusTransitionEffects(
			ctx,
			blockingTaskId,
			"done",
			"in-progress",
		);

		expect(effects).toEqual([
			{
				type: "blocked",
				blockedTaskId,
				blockingTaskId,
			},
		]);
	});
});
