import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import { TEAM_NAMES } from "../lib/constants";
import schema from "../schema";
import { modules } from "../test.setup";
import { captureError, getConvexErrorCode } from "../test_utils/convexError";

type ConvexTest = ReturnType<typeof convexTest>;

async function seedUserInTeam(
	t: ConvexTest,
	teamName: string,
	email: string,
): Promise<Id<"users">> {
	return await t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", { email });
		await ctx.db.insert("teams", {
			name: teamName,
			memberIds: [userId],
		});
		return userId;
	});
}

describe("refunds security", () => {
	test("delegates can list volunteers", async () => {
		const t = convexTest(schema, modules);
		const delegateId = await seedUserInTeam(
			t,
			TEAM_NAMES.DELEGATES,
			"delegate@example.com",
		);
		await t.run(async (ctx) => {
			await ctx.db.insert("refundVolunteers", {
				name: "Refund Volunteer",
				wcaId: "2024TEST01",
				transferToWcaIds: [],
				archived: false,
			});
		});

		const delegate = t.withIdentity({ subject: delegateId });
		const volunteers = await delegate.query(api.refunds.api.listVolunteers, {});
		expect(volunteers.length).toBe(1);
		expect(volunteers[0]?.name).toBe("Refund Volunteer");
	});

	test("volunteers cannot list volunteers", async () => {
		const t = convexTest(schema, modules);
		const volunteerId = await seedUserInTeam(
			t,
			TEAM_NAMES.VOLUNTEER,
			"volunteer@example.com",
		);
		const volunteer = t.withIdentity({ subject: volunteerId });
		const capturedError = await captureError(() =>
			volunteer.query(api.refunds.api.listVolunteers, {}),
		);

		expect(capturedError).toBeTruthy();
		expect(getConvexErrorCode(capturedError)).toBe("FORBIDDEN");
	});

	test("delegates can create, update, and delete volunteer records", async () => {
		const t = convexTest(schema, modules);
		const delegateId = await seedUserInTeam(
			t,
			TEAM_NAMES.DELEGATES,
			"delegate.manage@example.com",
		);
		const delegate = t.withIdentity({ subject: delegateId });

		const volunteerId = await delegate.mutation(
			api.refunds.api.createVolunteer,
			{
				name: "Managed Volunteer",
				wcaId: "2024MANA01",
				transferToWcaIds: [],
			},
		);

		await delegate.mutation(api.refunds.api.updateVolunteer, {
			id: volunteerId,
			name: "Managed Volunteer Updated",
			transferToWcaIds: ["2020MOVE01"],
		});

		const beforeDelete = await delegate.query(
			api.refunds.api.listVolunteers,
			{},
		);
		expect(
			beforeDelete.some(
				(volunteer: { id: string }) => volunteer.id === volunteerId,
			),
		).toBe(true);

		await delegate.mutation(api.refunds.api.deleteVolunteer, {
			id: volunteerId,
		});
		const afterDelete = await delegate.query(
			api.refunds.api.listVolunteers,
			{},
		);
		expect(
			afterDelete.some(
				(volunteer: { id: string }) => volunteer.id === volunteerId,
			),
		).toBe(false);
	});

	test("volunteers cannot compute refunds", async () => {
		const t = convexTest(schema, modules);
		const volunteerId = await seedUserInTeam(
			t,
			TEAM_NAMES.VOLUNTEER,
			"volunteer.compute@example.com",
		);
		const volunteer = t.withIdentity({ subject: volunteerId });
		const capturedError = await captureError(() =>
			volunteer.action(api.refunds.api.computeRefunds, {}),
		);

		expect(capturedError).toBeTruthy();
		expect(getConvexErrorCode(capturedError)).toBe("FORBIDDEN");
	});

	test("delegates pass auth for compute refunds", async () => {
		const t = convexTest(schema, modules);
		const delegateId = await seedUserInTeam(
			t,
			TEAM_NAMES.DELEGATES,
			"delegate.compute@example.com",
		);
		const delegate = t.withIdentity({ subject: delegateId });
		const capturedError = await captureError(() =>
			delegate.action(api.refunds.api.computeRefunds, {}),
		);

		expect(capturedError).toBeTruthy();
		// Missing WCA token is expected in test env and confirms auth passed.
		expect(getConvexErrorCode(capturedError)).toBe("PRECONDITION_FAILED");
	});
});
