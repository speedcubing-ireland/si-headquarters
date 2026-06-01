import { describe, expect, test } from "vitest";
import type { Doc } from "@/convex/_generated/dataModel";
import type { MutationCtx } from "@/convex/_generated/server";
import { describeAuctionFramework, sendAuctionScheduledEmails } from "./emails";
import {
	buildSponsorshipEmailHtml,
	buildSponsorshipEmailPlainText,
} from "../../emails/render"

type AuctionDoc = Doc<"sponsorshipAuctions">;
type CompetitionDoc = Doc<"competitions">;
type SponsorDoc = Doc<"sponsors">;
type InviteDoc = Doc<"sponsorshipAuctionInvites">;

function makeAuction(overrides: Partial<AuctionDoc> = {}): AuctionDoc {
	const now = Date.now();
	return {
		_id: "auction1" as AuctionDoc["_id"],
		_creationTime: now,
		competitionId: "comp1" as AuctionDoc["competitionId"],
		framework: "first_sealed",
		state: "scheduled",
		currency: "EUR",
		startsAt: now + 86_400_000,
		endsAt: now + 172_800_000,
		antiSnipingWindowMs: 300_000,
		antiSnipingExtendMs: 300_000,
		startPriceCents: 10_000,
		currentPriceCents: undefined,
		currentLeaderSponsorId: undefined,
		currentLeaderMaxCents: undefined,
		winnerSponsorId: undefined,
		winningBidId: undefined,
		settlementAmountCents: undefined,
		readinessSnapshotJson: undefined,
		createdById: "u1" as AuctionDoc["createdById"],
		updatedById: "u1" as AuctionDoc["updatedById"],
		updatedAt: now,
		...overrides,
	};
}

function makeCompetition(
	overrides: Partial<CompetitionDoc> = {},
): CompetitionDoc {
	return {
		_id: "comp1" as CompetitionDoc["_id"],
		_creationTime: Date.now(),
		name: "Irish Open 2026",
		description: null,
		people: {
			compLead: null,
			leadDelegate: null,
			organisers: [],
		},
		compDates: {
			from: "2026-09-01",
			to: "2026-09-02",
		},
		phaseId: null,
		updateId: null,
		...overrides,
	}
}

function makeSponsor(
	id: string,
	overrides: Partial<SponsorDoc> = {},
): SponsorDoc {
	return {
		_id: id as SponsorDoc["_id"],
		_creationTime: Date.now(),
		name: `Sponsor ${id}`,
		email: `${id}@example.com`,
		emailNormalized: `${id}@example.com`,
		active: true,
		createdById: "u1" as SponsorDoc["createdById"],
		updatedById: "u1" as SponsorDoc["updatedById"],
		updatedAt: Date.now(),
		...overrides,
	};
}

function makeInvite(auctionId: string, sponsorId: string): InviteDoc {
	return {
		_id: `invite-${sponsorId}` as InviteDoc["_id"],
		_creationTime: Date.now(),
		auctionId: auctionId as InviteDoc["auctionId"],
		sponsorId: sponsorId as InviteDoc["sponsorId"],
		invitedById: "u1" as InviteDoc["invitedById"],
		invitedAt: Date.now(),
	};
}

function createEmailCtx(input: {
	competition: CompetitionDoc | null;
	invites: InviteDoc[];
	sponsors: Map<string, SponsorDoc>;
}) {
	const scheduledCalls: {
		delayMs: number;
		fnRef: unknown;
		args: unknown;
	}[] = [];

	const ctx = {
		db: {
			get: async (table: string, id: string) => {
				if (table === "competitions") return input.competition;
				if (table === "sponsors") return input.sponsors.get(id) ?? null;
				return null;
			},
			query: (table: string) => {
				if (table === "sponsorshipAuctionInvites") {
					return {
						withIndex: () => ({
							collect: async () => input.invites,
						}),
					};
				}
				throw new Error(`Unexpected query table: ${table}`);
			},
		},
		scheduler: {
			runAfter: async (delayMs: number, fnRef: unknown, args: unknown) => {
				scheduledCalls.push({ delayMs, fnRef, args });
			},
		},
	} as unknown as MutationCtx;

	return { ctx, scheduledCalls };
}

describe("describeAuctionFramework", () => {
	test("first_sealed returns sealed-bid first-price description", () => {
		const result = describeAuctionFramework("first_sealed");
		expect(result).toContain("Sealed bid");
		expect(result).toContain("pays their bid amount");
	});

	test("vickrey returns sealed-bid second-price description", () => {
		const result = describeAuctionFramework("vickrey");
		expect(result).toContain("sealed bid");
		expect(result).toContain("second-highest bid");
	});

	test("ebay_proxy returns proxy-bid description", () => {
		const result = describeAuctionFramework("ebay_proxy");
		expect(result).toContain("Proxy bidding");
		expect(result).toContain("maximum bid");
	});
});

describe("sendAuctionScheduledEmails", () => {
	test("enqueues scheduled emails for all invited sponsors", async () => {
		const auction = makeAuction({ framework: "vickrey" });
		const competition = makeCompetition({ name: "Munster Open 2026" });
		const sponsorA = makeSponsor("sA");
		const sponsorB = makeSponsor("sB");
		const invites = [
			makeInvite("auction1", "sA"),
			makeInvite("auction1", "sB"),
		];
		const sponsors = new Map([
			["sA", sponsorA],
			["sB", sponsorB],
		]);

		const { ctx, scheduledCalls } = createEmailCtx({
			competition,
			invites,
			sponsors,
		});

		await sendAuctionScheduledEmails(ctx, auction);

		expect(scheduledCalls).toHaveLength(1);
		const call = scheduledCalls[0];
		expect(call.delayMs).toBe(0);

		const args = call.args as {
			emailType: string;
			subject: string;
			recipients: { sponsorId: string; email: string; name: string }[];
			context: {
				competitionName: string;
				frameworkDescription: string;
				startPriceCents: number;
				currency: string;
				startsAt: number;
				endsAt: number;
				portalUrl: string;
			};
		};

		expect(args.emailType).toBe("auction_scheduled");
		expect(args.recipients).toHaveLength(2);
		expect(args.subject).toBe("Munster Open 2026: bidding opening soon");

		expect(args.context.competitionName).toBe("Munster Open 2026");
		expect(args.context.frameworkDescription).toBe(
			describeAuctionFramework("vickrey"),
		);
		expect(args.context.startPriceCents).toBe(10_000);
		expect(args.context.currency).toBe("EUR");
		expect(args.context.startsAt).toBe(auction.startsAt);
		expect(args.context.endsAt).toBe(auction.endsAt);
		expect(args.context.portalUrl).toContain(String(auction._id));
	});

	test("returns early without scheduling when competition is missing", async () => {
		const auction = makeAuction();
		const { ctx, scheduledCalls } = createEmailCtx({
			competition: null,
			invites: [makeInvite("auction1", "sA")],
			sponsors: new Map([["sA", makeSponsor("sA")]]),
		});

		await sendAuctionScheduledEmails(ctx, auction);

		expect(scheduledCalls).toHaveLength(0);
	});

	test("does not schedule when auction has no invites", async () => {
		const auction = makeAuction();
		const competition = makeCompetition();
		const { ctx, scheduledCalls } = createEmailCtx({
			competition,
			invites: [],
			sponsors: new Map(),
		});

		await sendAuctionScheduledEmails(ctx, auction);

		expect(scheduledCalls).toHaveLength(0);
	});

	test("filters out deleted sponsors and sends to remaining", async () => {
		const auction = makeAuction();
		const competition = makeCompetition();
		const sponsorA = makeSponsor("sA");
		const invites = [
			makeInvite("auction1", "sA"),
			makeInvite("auction1", "sB"),
		];

		const { ctx, scheduledCalls } = createEmailCtx({
			competition,
			invites,
			sponsors: new Map([["sA", sponsorA]]),
		});

		await sendAuctionScheduledEmails(ctx, auction);

		expect(scheduledCalls).toHaveLength(1);
		const args = scheduledCalls[0].args as {
			recipients: { sponsorId: string }[];
		};
		expect(args.recipients).toHaveLength(1);
		expect(args.recipients[0].sponsorId).toBe("sA");
	});

	test("filters out inactive sponsors from lifecycle emails", async () => {
		const auction = makeAuction();
		const competition = makeCompetition();
		const sponsorA = makeSponsor("sA");
		const sponsorB = makeSponsor("sB", { active: false });
		const invites = [
			makeInvite("auction1", "sA"),
			makeInvite("auction1", "sB"),
		];

		const { ctx, scheduledCalls } = createEmailCtx({
			competition,
			invites,
			sponsors: new Map([
				["sA", sponsorA],
				["sB", sponsorB],
			]),
		});

		await sendAuctionScheduledEmails(ctx, auction);

		expect(scheduledCalls).toHaveLength(1);
		const args = scheduledCalls[0].args as {
			recipients: { sponsorId: string; email: string; name: string }[];
		};
		expect(args.recipients).toEqual([
			{ sponsorId: "sA", email: "sA@example.com", name: "Sponsor sA" },
		]);
	});

	describe("framework description is passed through context", () => {
		const frameworks = ["first_sealed", "vickrey", "ebay_proxy"] as const;

		for (const framework of frameworks) {
			test(`${framework} auction passes matching frameworkDescription`, async () => {
				const auction = makeAuction({ framework });
				const competition = makeCompetition();
				const { ctx, scheduledCalls } = createEmailCtx({
					competition,
					invites: [makeInvite("auction1", "sA")],
					sponsors: new Map([["sA", makeSponsor("sA")]]),
				});

				await sendAuctionScheduledEmails(ctx, auction);

				expect(scheduledCalls).toHaveLength(1);
				const args = scheduledCalls[0].args as {
					context: { frameworkDescription: string };
				};
				expect(args.context.frameworkDescription).toBe(
					describeAuctionFramework(framework),
				);
			});
		}
	});

	test("subject line includes the competition name", async () => {
		const auction = makeAuction();
		const competition = makeCompetition({ name: "Connacht Open 2026" });
		const { ctx, scheduledCalls } = createEmailCtx({
			competition,
			invites: [makeInvite("auction1", "sA")],
			sponsors: new Map([["sA", makeSponsor("sA")]]),
		});

		await sendAuctionScheduledEmails(ctx, auction);

		const args = scheduledCalls[0].args as { subject: string };
		expect(args.subject).toContain("Connacht Open 2026");
	});

});

describe("buildSponsorshipEmailHtml — outcome template formats dates as en-IE", () => {
	// 31 Jan 2026 14:30 UTC — day ≠ month so American vs Irish is distinguishable
	const fixedTs = Date.UTC(2026, 0, 31, 14, 30);
	const expectedDateSubstring = new Date(fixedTs).toLocaleString("en-IE", {
		dateStyle: "full",
		timeStyle: "short",
		timeZone: "Europe/Dublin",
	});

	const baseContext = {
		competitionName: "Irish Open 2026",
		portalUrl: "https://hq.speedcubing.ie/sponsor/auctions/abc123",
		startsAt: fixedTs,
		endsAt: fixedTs,
	};

	test("auction_started body and Ends row use Irish date format", async () => {
		const html = await buildSponsorshipEmailHtml({
			emailType: "auction_started",
			context: baseContext,
			messageFallback: "fallback",
		});
		expect(html).toContain(expectedDateSubstring);
		expect(html).not.toContain("1/31/2026");
		expect(html).not.toContain("01/31/2026");
		expect(html).not.toMatch(/January\s+31/);
	});

	test("auction_started plain text uses Irish date format", async () => {
		const text = await buildSponsorshipEmailPlainText({
			emailType: "auction_started",
			context: baseContext,
			messageFallback: "fallback",
		});
		expect(text).toContain(expectedDateSubstring);
		expect(text).not.toContain("1/31/2026");
		expect(text).not.toContain("01/31/2026");
	});

	test("auction_closed_winner Starts and Ends rows use Irish date format", async () => {
		const html = await buildSponsorshipEmailHtml({
			emailType: "auction_closed_winner",
			context: { ...baseContext, settlementAmountCents: 100_000 },
			messageFallback: "fallback",
		});
		// Both Starts and Ends rows are present; expectedDateSubstring should appear twice
		const occurrences = html.split(expectedDateSubstring).length - 1;
		expect(occurrences).toBeGreaterThanOrEqual(2);
		expect(html).not.toContain("1/31/2026");
		expect(html).not.toContain("01/31/2026");
	});
});

describe("buildSponsorshipEmailHtml — auction_scheduled template", () => {
	const fullContext = {
		competitionName: "Irish Open 2026",
		portalUrl: "https://hq.speedcubing.ie/sponsor/auctions/abc123",
		startsAt: Date.now() + 86_400_000,
		endsAt: Date.now() + 172_800_000,
		frameworkDescription: describeAuctionFramework("first_sealed"),
		startPriceCents: 10_000,
		currency: "EUR",
	};

	test("renders non-empty HTML with competition name and portal link", async () => {
		const html = await buildSponsorshipEmailHtml({
			emailType: "auction_scheduled",
			recipientName: "Acme Corp",
			context: fullContext,
			messageFallback: "fallback",
		});
		expect(html.length).toBeGreaterThan(100);
		expect(html).toContain("Irish Open 2026");
		expect(html).toContain("abc123");
	});

	test("renders non-empty plain text with competition name", async () => {
		const text = await buildSponsorshipEmailPlainText({
			emailType: "auction_scheduled",
			recipientName: "Acme Corp",
			context: fullContext,
			messageFallback: "fallback",
		});
		expect(text.length).toBeGreaterThan(50);
		expect(text).toContain("Irish Open 2026");
	});

	test("falls back to messageFallback when context is missing competitionName", async () => {
		const html = await buildSponsorshipEmailHtml({
			emailType: "auction_scheduled",
			recipientName: "Acme Corp",
			context: { portalUrl: "https://example.com" },
			messageFallback: "Auction coming soon",
		});
		expect(html).toContain("Auction coming soon");
	});

	test("falls back to messageFallback when context is missing portalUrl", async () => {
		const html = await buildSponsorshipEmailHtml({
			emailType: "auction_scheduled",
			recipientName: "Acme Corp",
			context: { competitionName: "Irish Open 2026" },
			messageFallback: "Auction coming soon",
		});
		expect(html).toContain("Auction coming soon");
	});

	test("renders without optional fields (no startsAt, endsAt, framework, price)", async () => {
		const html = await buildSponsorshipEmailHtml({
			emailType: "auction_scheduled",
			recipientName: "Acme Corp",
			context: {
				competitionName: "Irish Open 2026",
				portalUrl: "https://example.com/portal",
			},
			messageFallback: "fallback",
		});
		expect(html).toContain("Irish Open 2026");
		expect(html).not.toContain("fallback");
	});
});

describe("buildSponsorshipEmailHtml — internal_invoice template", () => {
	const baseContext = {
		competitionName: "Irish Open 2026",
		adminUrl: "https://hq.speedcubing.ie/admin/sponsorship",
	};

	test("renders HTML with action message and next steps when there is a winner", async () => {
		const html = await buildSponsorshipEmailHtml({
			emailType: "internal_invoice",
			context: {
				...baseContext,
				winnerSponsorName: "Acme Corp",
				settlementAmountCents: 125000,
			},
			messageFallback:
				"Winner confirmed: Acme Corp at EUR 1250.00. Send invoice follow-up.",
		});
		expect(html).toContain("Irish Open 2026");
		expect(html).toContain("Acme Corp");
		expect(html).toContain(
			"Winner confirmed: Acme Corp at EUR 1250.00. Send invoice follow-up.",
		);
		expect(html).toContain("Next steps");
	});

	test("renders HTML with action message and no next steps when no winner", async () => {
		const html = await buildSponsorshipEmailHtml({
			emailType: "internal_invoice",
			context: baseContext,
			messageFallback:
				"No winning sponsor. Mark competition sponsorship status as None or relaunch.",
		});
		expect(html).toContain("Irish Open 2026");
		expect(html).toContain(
			"No winning sponsor. Mark competition sponsorship status as None or relaunch.",
		);
		expect(html).not.toContain("Next steps");
	});

	test("renders plain text with action message", async () => {
		const text = await buildSponsorshipEmailPlainText({
			emailType: "internal_invoice",
			context: {
				...baseContext,
				winnerSponsorName: "Acme Corp",
				settlementAmountCents: 125000,
			},
			messageFallback:
				"Winner confirmed: Acme Corp at EUR 1250.00. Send invoice follow-up.",
		});
		expect(text).toContain("Irish Open 2026");
		expect(text).toContain(
			"Winner confirmed: Acme Corp at EUR 1250.00. Send invoice follow-up.",
		);
	});

	test("falls back to messageFallback when context is missing adminUrl", async () => {
		const html = await buildSponsorshipEmailHtml({
			emailType: "internal_invoice",
			context: { competitionName: "Irish Open 2026" },
			messageFallback: "Invoice follow-up needed",
		});
		expect(html).toContain("Invoice follow-up needed");
	});
});
