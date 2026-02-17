import { describe, expect, it } from "vitest";
import type { RegistrationDataV2 } from "./services/wca/client/types.gen";
import { buildRefundDecision, type RefundVolunteer } from "./lib/refunds";

function makeVolunteer(
	id: string,
	name: string,
	wcaId: string,
	transferToWcaIds: string[] = [],
): RefundVolunteer {
	return { id, name, wcaId, transferToWcaIds };
}

function makeRegistration(args: {
	id: number;
	name: string;
	wcaId: string;
	status: string;
	hasPaid?: boolean;
}): RegistrationDataV2 {
	return {
		id: args.id,
		registrant_id: args.id * 10,
		user_id: args.id * 100,
		user: {
			id: args.id * 100,
			name: args.name,
			gender: "m",
			country_iso2: "IE",
			wca_id: args.wcaId,
		},
		competing: {
			event_ids: ["333"],
			registration_status: args.status,
		},
		payment: {
			has_paid: args.hasPaid,
		},
	};
}

describe("buildRefundDecision", () => {
	it("keeps unpaid volunteers as already refunded while still marking other dues", () => {
		const volunteers = [
			makeVolunteer("v1", "Alex", "2020ALEX01"),
			makeVolunteer("v2", "Blair", "2020BLAI01"),
		];
		const registrations = [
			makeRegistration({
				id: 1,
				name: "Alex",
				wcaId: "2020ALEX01",
				status: "accepted",
				hasPaid: false,
			}),
			makeRegistration({
				id: 2,
				name: "Blair",
				wcaId: "2020BLAI01",
				status: "accepted",
				hasPaid: true,
			}),
		];

		const decision = buildRefundDecision({ registrations, volunteers });
		expect(decision.status).toBe("refund_due");
		expect(decision.alreadyRefundedVolunteerIds).toEqual(["v1"]);
		expect(decision.dueVolunteerIds).toEqual(["v2"]);
	});

	it("marks all matching volunteers as due when accepted and paid", () => {
		const volunteers = [
			makeVolunteer("v1", "Alex", "2020ALEX01"),
			makeVolunteer("v2", "Blair", "2020BLAI01"),
		];
		const registrations = [
			makeRegistration({
				id: 10,
				name: "Blair",
				wcaId: "2020BLAI01",
				status: "accepted",
				hasPaid: true,
			}),
			makeRegistration({
				id: 11,
				name: "Alex",
				wcaId: "2020ALEX01",
				status: "accepted",
				hasPaid: true,
			}),
		];

		const decision = buildRefundDecision({ registrations, volunteers });
		expect(decision.status).toBe("refund_due");
		expect(decision.dueVolunteerIds).toEqual(["v1", "v2"]);
		expect(decision.alreadyRefundedVolunteerIds).toEqual([]);
	});

	it("treats accepted unpaid registrations as already refunded", () => {
		const volunteers = [makeVolunteer("v1", "Casey", "2020CASE01")];
		const registrations = [
			makeRegistration({
				id: 20,
				name: "Casey",
				wcaId: "2020CASE01",
				status: "accepted",
				hasPaid: false,
			}),
		];

		const decision = buildRefundDecision({ registrations, volunteers });
		expect(decision.status).toBe("already_refunded");
		expect(decision.alreadyRefundedVolunteerIds).toEqual(["v1"]);
		expect(decision.dueVolunteerIds).toEqual([]);
	});

	it("returns no eligible volunteer when no accepted volunteer registrations match", () => {
		const volunteers = [makeVolunteer("v1", "Dana", "2020DANA01")];
		const registrations = [
			makeRegistration({
				id: 30,
				name: "Dana",
				wcaId: "2020DANA01",
				status: "pending",
				hasPaid: true,
			}),
			makeRegistration({
				id: 31,
				name: "Else",
				wcaId: "2020ELSE01",
				status: "accepted",
				hasPaid: true,
			}),
		];

		const decision = buildRefundDecision({ registrations, volunteers });
		expect(decision.status).toBe("no_eligible_volunteer");
		expect(decision.alreadyRefundedVolunteerIds).toEqual([]);
		expect(decision.dueVolunteerIds).toEqual([]);
	});

	it("treats transfer target WCA IDs as volunteer matches", () => {
		const volunteers = [
			makeVolunteer("v1", "Volunteer", "2020VOLU01", ["2015KID01"]),
		];
		const registrations = [
			makeRegistration({
				id: 40,
				name: "Child Competitor",
				wcaId: "2015KID01",
				status: "accepted",
				hasPaid: true,
			}),
		];

		const decision = buildRefundDecision({ registrations, volunteers });
		expect(decision.status).toBe("refund_due");
		expect(decision.dueVolunteerIds).toEqual(["v1"]);
		expect(decision.volunteerMatches[0]?.matchedWcaIds).toEqual(["2015KID01"]);
	});

	it("marks multiple volunteers as due when multiple paid accepted matches exist", () => {
		const volunteers = [
			makeVolunteer("v1", "First", "2020FIRS01"),
			makeVolunteer("v2", "Second", "2020SECO01"),
		];
		const registrations = [
			makeRegistration({
				id: 50,
				name: "First",
				wcaId: "2020FIRS01",
				status: "accepted",
				hasPaid: true,
			}),
			makeRegistration({
				id: 51,
				name: "Second",
				wcaId: "2020SECO01",
				status: "accepted",
				hasPaid: true,
			}),
		];

		const decision = buildRefundDecision({ registrations, volunteers });
		expect(decision.status).toBe("refund_due");
		expect(decision.dueVolunteerIds).toEqual(["v1", "v2"]);
		expect(decision.alreadyRefundedVolunteerIds).toEqual([]);
	});

	it("returns no eligible volunteer when volunteers list is empty", () => {
		const volunteers: RefundVolunteer[] = [];
		const registrations = [
			makeRegistration({
				id: 60,
				name: "Someone",
				wcaId: "2020SOME01",
				status: "accepted",
				hasPaid: true,
			}),
		];

		const decision = buildRefundDecision({ registrations, volunteers });
		expect(decision.status).toBe("no_eligible_volunteer");
		expect(decision.dueVolunteerIds).toEqual([]);
		expect(decision.alreadyRefundedVolunteerIds).toEqual([]);
	});

	it("returns no eligible volunteer when registrations list is empty", () => {
		const volunteers = [makeVolunteer("v1", "Test", "2020TEST01")];
		const registrations: RegistrationDataV2[] = [];

		const decision = buildRefundDecision({ registrations, volunteers });
		expect(decision.status).toBe("no_eligible_volunteer");
		expect(decision.dueVolunteerIds).toEqual([]);
		expect(decision.alreadyRefundedVolunteerIds).toEqual([]);
	});

	it("handles multiple transfer WCA IDs for single volunteer", () => {
		const volunteers = [
			makeVolunteer("v1", "Parent", "2020PARE01", ["2015KID01", "2018TEEN01"]),
		];
		const registrations = [
			makeRegistration({
				id: 70,
				name: "Kid",
				wcaId: "2015KID01",
				status: "accepted",
				hasPaid: false,
			}),
			makeRegistration({
				id: 71,
				name: "Teen",
				wcaId: "2018TEEN01",
				status: "accepted",
				hasPaid: false,
			}),
		];

		const decision = buildRefundDecision({ registrations, volunteers });
		expect(decision.status).toBe("already_refunded");
		expect(decision.volunteerMatches[0]?.matchedWcaIds).toEqual([
			"2015KID01",
			"2018TEEN01",
		]);
		expect(decision.volunteerMatches[0]?.acceptedCount).toBe(2);
	});

	it("normalizes WCA ID case when matching", () => {
		const volunteers = [makeVolunteer("v1", "Test", "2020test01")];
		const registrations = [
			makeRegistration({
				id: 80,
				name: "Test",
				wcaId: "2020TEST01",
				status: "accepted",
				hasPaid: true,
			}),
		];

		const decision = buildRefundDecision({ registrations, volunteers });
		expect(decision.status).toBe("refund_due");
		expect(decision.dueVolunteerIds).toEqual(["v1"]);
	});

	it("handles volunteer with no personal WCA ID but transfer IDs", () => {
		const volunteers = [
			{
				id: "v1",
				name: "Guardian",
				transferToWcaIds: ["2015CHILD01"],
			},
		] as RefundVolunteer[];
		const registrations = [
			makeRegistration({
				id: 90,
				name: "Child",
				wcaId: "2015CHILD01",
				status: "accepted",
				hasPaid: true,
			}),
		];

		const decision = buildRefundDecision({ registrations, volunteers });
		expect(decision.status).toBe("refund_due");
		expect(decision.dueVolunteerIds).toEqual(["v1"]);
		expect(decision.volunteerMatches[0]?.matchedWcaIds).toEqual([
			"2015CHILD01",
		]);
	});
});
