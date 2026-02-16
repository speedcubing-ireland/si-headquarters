import { describe, expect, it } from "vitest";
import type {
	RegistrationDataV2,
	WcifPerson,
} from "./services/wca/client/types.gen";
import { buildCheckinSheetRows, getRegistrationStatus } from "./wcaSchedule";

function makeRegistration(args: {
	id: number;
	registrantId: number;
	userId: number;
	name: string;
	gender?: string;
	countryIso2?: string;
	wcaId?: string;
	status?: string;
	events?: string[];
	guests?: number;
}): RegistrationDataV2 {
	return {
		id: args.id,
		registrant_id: args.registrantId,
		user_id: args.userId,
		guests: args.guests,
		user: {
			id: args.userId,
			name: args.name,
			gender: args.gender ?? "m",
			country_iso2: args.countryIso2 ?? "IE",
			wca_id: args.wcaId ?? "",
		},
		competing: {
			event_ids: args.events ?? [],
			registration_status: args.status ?? "accepted",
		},
	};
}

function makePerson(args: {
	registrantId: number;
	wcaUserId: number;
	birthdate?: string;
	email?: string;
}): WcifPerson {
	return {
		registrantId: args.registrantId,
		name: "Competitor",
		wcaUserId: args.wcaUserId,
		countryIso2: "IE",
		gender: "m",
		birthdate: args.birthdate,
		email: args.email,
		roles: [],
		assignments: [],
		personalBests: [],
		extensions: [],
	};
}

describe("buildCheckinSheetRows", () => {
	it("keeps only accepted registrations and fills missing fields with blanks", () => {
		const rows = buildCheckinSheetRows(
			[
				makeRegistration({
					id: 1,
					registrantId: 101,
					userId: 501,
					name: "Pending Person",
					status: "pending",
					events: ["333"],
				}),
				makeRegistration({
					id: 2,
					registrantId: 102,
					userId: 502,
					name: "Zoe Example",
					status: "accepted",
					events: ["222", "333bf"],
				}),
				makeRegistration({
					id: 3,
					registrantId: 103,
					userId: 503,
					name: "Amy Beta",
					gender: "f",
					wcaId: "2019BETA01",
					status: "accepted",
					events: ["333", "skewb", "333mbf"],
					guests: 2,
				}),
			],
			[
				makePerson({
					registrantId: 103,
					wcaUserId: 503,
					birthdate: "2001-02-03",
					email: "amy@example.com",
				}),
			],
		);

		expect(rows).toEqual([
			[
				"accepted",
				"Amy Beta",
				"Ireland",
				"2019BETA01",
				"2001-02-03",
				"f",
				"1",
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				"1",
				"1",
				"amy@example.com",
				"2",
				null,
			],
			[
				"accepted",
				"Zoe Example",
				"Ireland",
				null,
				null,
				"m",
				null,
				"1",
				null,
				null,
				null,
				null,
				"1",
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null,
			],
		]);
	});

	it("sorts alphabetically by first name with full-name tiebreaker", () => {
		const rows = buildCheckinSheetRows(
			[
				makeRegistration({
					id: 11,
					registrantId: 111,
					userId: 511,
					name: "Brian C",
				}),
				makeRegistration({
					id: 12,
					registrantId: 112,
					userId: 512,
					name: "Alex Zed",
				}),
				makeRegistration({
					id: 13,
					registrantId: 113,
					userId: 513,
					name: "Alex Aaron",
				}),
			],
			undefined,
		);

		expect(rows.map((row) => row[1])).toEqual([
			"Alex Aaron",
			"Alex Zed",
			"Brian C",
		]);
	});

	it("reads status from competing.status when registration_status is absent", () => {
		const registration = makeRegistration({
			id: 21,
			registrantId: 121,
			userId: 521,
			name: "Status Fallback",
		});
		delete registration.competing.registration_status;
		(
			registration.competing as unknown as {
				status?: string;
			}
		).status = "accepted";

		expect(getRegistrationStatus(registration)).toBe("accepted");

		const rows = buildCheckinSheetRows([registration], undefined);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.[0]).toBe("accepted");
	});
});
