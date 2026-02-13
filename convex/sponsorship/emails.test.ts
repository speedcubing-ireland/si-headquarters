import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { enqueueSponsorshipEmailBatch } from "./emails";

type DispatchDoc = Doc<"sponsorshipEmailDispatches">;
type ScheduledCall = {
	kind: "runAfter" | "runAt";
	dispatchId: Id<"sponsorshipEmailDispatches">;
};

function createMockCtx() {
	const dispatches: DispatchDoc[] = [];
	const scheduledCalls: ScheduledCall[] = [];
	let dispatchCounter = 0;
	let scheduledCounter = 0;

	const ctx = {
		db: {
			query: (table: string) => {
				if (table !== "sponsorshipEmailDispatches") {
					throw new Error(`Unexpected query table: ${table}`);
				}
				return {
					withIndex: (
						indexName: string,
						builder: (q: {
							eq: (field: string, value: string) => unknown;
						}) => unknown,
					) => {
						if (indexName !== "by_idempotency_key") {
							throw new Error(`Unexpected index: ${indexName}`);
						}
						let idempotencyKey = "";
						const q = {
							eq: (_field: string, value: string) => {
								idempotencyKey = value;
								return q;
							},
						};
						builder(q);
						return {
							first: async () =>
								dispatches.find(
									(dispatch) => dispatch.idempotencyKey === idempotencyKey,
								) ?? null,
						};
					},
				};
			},
			insert: async (
				table: string,
				value: Omit<DispatchDoc, "_id" | "_creationTime">,
			) => {
				if (table !== "sponsorshipEmailDispatches") {
					throw new Error(`Unexpected insert table: ${table}`);
				}
				dispatchCounter += 1;
				const doc = {
					...value,
					_id: `dispatch-${dispatchCounter}` as Id<"sponsorshipEmailDispatches">,
					_creationTime: Date.now(),
				} as DispatchDoc;
				dispatches.push(doc);
				return doc._id;
			},
			get: async (table: string, id: Id<"sponsorshipEmailDispatches">) => {
				if (table !== "sponsorshipEmailDispatches") {
					throw new Error(`Unexpected get table: ${table}`);
				}
				return dispatches.find((dispatch) => dispatch._id === id) ?? null;
			},
			patch: async (
				table: string,
				id: Id<"sponsorshipEmailDispatches">,
				patch: Partial<DispatchDoc>,
			) => {
				if (table !== "sponsorshipEmailDispatches") {
					throw new Error(`Unexpected patch table: ${table}`);
				}
				const existing = dispatches.find((dispatch) => dispatch._id === id);
				if (!existing) return;
				Object.assign(existing, patch);
			},
		},
		scheduler: {
			runAfter: async (
				_delayMs: number,
				_handler: unknown,
				args: { dispatchId: Id<"sponsorshipEmailDispatches"> },
			) => {
				scheduledCounter += 1;
				scheduledCalls.push({ kind: "runAfter", dispatchId: args.dispatchId });
				return `scheduled-after-${scheduledCounter}` as Id<"_scheduled_functions">;
			},
			runAt: async (
				_timeMs: number,
				_handler: unknown,
				args: { dispatchId: Id<"sponsorshipEmailDispatches"> },
			) => {
				scheduledCounter += 1;
				scheduledCalls.push({ kind: "runAt", dispatchId: args.dispatchId });
				return `scheduled-at-${scheduledCounter}` as Id<"_scheduled_functions">;
			},
			cancel: async () => undefined,
		},
	} as unknown as MutationCtx;

	return { ctx, dispatches, scheduledCalls };
}

describe("sponsorship email dispatch enqueue", () => {
	test("queues and schedules a dispatch", async () => {
		const { ctx, dispatches, scheduledCalls } = createMockCtx();
		const result = await enqueueSponsorshipEmailBatch(ctx, {
			batchKey: "batch-1",
			emailType: "auction_started",
			subject: "Auction is live",
			message: "Bidding is open.",
			recipients: [{ email: "Sponsor@Example.com", name: "Sponsor" }],
		});

		expect(result).toEqual({ queued: 1, skipped: 0 });
		expect(dispatches).toHaveLength(1);
		expect(dispatches[0]?.recipient).toBe("sponsor@example.com");
		expect(dispatches[0]?.idempotencyKey).toContain("sponsor@example.com");
		expect(dispatches[0]?.scheduledFunctionId).toBeDefined();
		expect(scheduledCalls).toHaveLength(1);
	});

	test("skips duplicate idempotency keys for the same batch", async () => {
		const { ctx, dispatches, scheduledCalls } = createMockCtx();
		await enqueueSponsorshipEmailBatch(ctx, {
			batchKey: "batch-1",
			emailType: "auction_started",
			subject: "Auction is live",
			message: "Bidding is open.",
			recipients: [{ email: "sponsor@example.com", name: "Sponsor" }],
		});
		const result = await enqueueSponsorshipEmailBatch(ctx, {
			batchKey: "batch-1",
			emailType: "auction_started",
			subject: "Auction is live",
			message: "Bidding is open.",
			recipients: [{ email: "SPONSOR@example.com", name: "Sponsor" }],
		});

		expect(result).toEqual({ queued: 0, skipped: 1 });
		expect(dispatches).toHaveLength(1);
		expect(scheduledCalls).toHaveLength(1);
	});

	test("rejects empty recipient batches", async () => {
		const { ctx } = createMockCtx();
		await expect(
			enqueueSponsorshipEmailBatch(ctx, {
				batchKey: "batch-1",
				emailType: "auction_started",
				subject: "Auction is live",
				message: "Bidding is open.",
				recipients: [],
			}),
		).rejects.toMatchObject({
			data: {
				code: "BAD_REQUEST",
			},
		});
	});
});
