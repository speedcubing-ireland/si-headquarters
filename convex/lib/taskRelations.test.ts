import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Id } from "../_generated/dataModel";

const {
	sendTaskRelationBlockedNotifications,
	sendTaskRelationUnblockedNotifications,
} = vi.hoisted(() => ({
	sendTaskRelationBlockedNotifications: vi.fn(),
	sendTaskRelationUnblockedNotifications: vi.fn(),
}));

vi.mock("../taskNotifications", () => ({
	sendTaskRelationBlockedNotifications,
	sendTaskRelationUnblockedNotifications,
}));

import { handleBlockingStatusTransitionNotifications } from "./taskRelations";

const taskId = (id: string) => id as Id<"tasks">;
const userId = (id: string) => id as Id<"users">;

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

describe("handleBlockingStatusTransitionNotifications", () => {
	beforeEach(() => {
		sendTaskRelationBlockedNotifications.mockReset();
		sendTaskRelationUnblockedNotifications.mockReset();
	});

	test("sends relation_unblocked when the last blocker resolves", async () => {
		const blockedTaskId = taskId("task-blocked");
		const blockingTaskId = taskId("task-blocking");
		const actorId = userId("user-1");
		const ctx = makeCtx({
			relations: [{ blockedTaskId, blockingTaskId }],
			taskStatuses: {
				"task-blocking": "done",
			},
		});

		await handleBlockingStatusTransitionNotifications(
			ctx,
			blockingTaskId,
			"in-progress",
			"done",
			actorId,
		);

		expect(sendTaskRelationUnblockedNotifications).toHaveBeenCalledTimes(1);
		expect(sendTaskRelationUnblockedNotifications).toHaveBeenCalledWith(
			ctx,
			blockedTaskId,
			blockingTaskId,
			actorId,
		);
		expect(sendTaskRelationBlockedNotifications).not.toHaveBeenCalled();
	});

	test("does not send relation_unblocked when other unresolved blockers remain", async () => {
		const blockedTaskId = taskId("task-blocked");
		const blockingTaskId = taskId("task-blocking");
		const secondaryBlockerId = taskId("task-secondary");
		const actorId = userId("user-1");
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

		await handleBlockingStatusTransitionNotifications(
			ctx,
			blockingTaskId,
			"in-progress",
			"done",
			actorId,
		);

		expect(sendTaskRelationUnblockedNotifications).not.toHaveBeenCalled();
		expect(sendTaskRelationBlockedNotifications).not.toHaveBeenCalled();
	});

	test("sends relation_blocked when task becomes the first unresolved blocker", async () => {
		const blockedTaskId = taskId("task-blocked");
		const blockingTaskId = taskId("task-blocking");
		const actorId = userId("user-1");
		const ctx = makeCtx({
			relations: [{ blockedTaskId, blockingTaskId }],
			taskStatuses: {
				"task-blocking": "in-progress",
			},
		});

		await handleBlockingStatusTransitionNotifications(
			ctx,
			blockingTaskId,
			"done",
			"in-progress",
			actorId,
		);

		expect(sendTaskRelationBlockedNotifications).toHaveBeenCalledTimes(1);
		expect(sendTaskRelationBlockedNotifications).toHaveBeenCalledWith(
			ctx,
			blockedTaskId,
			blockingTaskId,
			actorId,
		);
		expect(sendTaskRelationUnblockedNotifications).not.toHaveBeenCalled();
	});
});
