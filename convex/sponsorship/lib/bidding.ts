export type ProxyContender<TSponsorId extends string> = {
	sponsorId: TSponsorId;
	maxAmountCents: number;
	firstMaxSetAt: number;
	firstMaxSetOrder?: number;
};

export type ProxyState<TSponsorId extends string> = {
	currentPriceCents: number;
	leaderSponsorId: TSponsorId;
	leaderMaxCents: number;
	runnerUpMaxCents: number | null;
};

export type SealedBidIntent<
	TSponsorId extends string,
	TIntentId extends string,
> = {
	intentId: TIntentId;
	sponsorId: TSponsorId;
	amountCents: number;
	createdAt: number;
	createdOrder: number;
};

export type SealedOutcome<
	TSponsorId extends string,
	TIntentId extends string,
> = {
	leaderSponsorId: TSponsorId;
	leaderIntentId: TIntentId;
	leaderBidCents: number;
	settlementBidCents: number;
};

export type SealedPricing = "first_price" | "second_price";

type SealedResolutionOptions = {
	pricing?: SealedPricing;
	reservePriceCents?: number;
};

type IncrementBracket = {
	minCents: number;
	maxCents: number | null;
	incrementCents: number;
};

function compareStringIdsAsc(a: string, b: string): number {
	return a.localeCompare(b);
}

function compareSealedIntentChronology(
	a: SealedBidIntent<string, string>,
	b: SealedBidIntent<string, string>,
): number {
	if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
	if (a.createdOrder !== b.createdOrder) return a.createdOrder - b.createdOrder;
	return compareStringIdsAsc(a.intentId, b.intentId);
}

export const EBAY_DE_EUR_INCREMENT_BRACKETS: IncrementBracket[] = [
	{ minCents: 100, maxCents: 499, incrementCents: 20 },
	{ minCents: 500, maxCents: 2499, incrementCents: 50 },
	{ minCents: 2500, maxCents: 9999, incrementCents: 100 },
	{ minCents: 10000, maxCents: 24999, incrementCents: 250 },
	{ minCents: 25000, maxCents: 49999, incrementCents: 500 },
	{ minCents: 50000, maxCents: 99999, incrementCents: 1000 },
	{ minCents: 100000, maxCents: 249999, incrementCents: 2000 },
	{ minCents: 250000, maxCents: 499999, incrementCents: 5000 },
	{ minCents: 500000, maxCents: null, incrementCents: 10000 },
];

export function incrementForEbayDeEur(amountCents: number): number {
	for (const bracket of EBAY_DE_EUR_INCREMENT_BRACKETS) {
		const withinLower = amountCents >= bracket.minCents;
		const withinUpper =
			bracket.maxCents === null || amountCents <= bracket.maxCents;
		if (withinLower && withinUpper) {
			return bracket.incrementCents;
		}
	}
	return 20;
}

export function minNextBidCents(
	currentPriceCents: number | null,
	startPriceCents: number,
): number {
	if (currentPriceCents === null) return startPriceCents;
	return currentPriceCents + incrementForEbayDeEur(currentPriceCents);
}

function sortProxyContenders<TSponsorId extends string>(
	contenders: ProxyContender<TSponsorId>[],
): ProxyContender<TSponsorId>[] {
	return [...contenders].sort((a, b) => {
		if (b.maxAmountCents !== a.maxAmountCents) {
			return b.maxAmountCents - a.maxAmountCents;
		}
		if (a.firstMaxSetAt !== b.firstMaxSetAt) {
			return a.firstMaxSetAt - b.firstMaxSetAt;
		}
		const aOrder = a.firstMaxSetOrder ?? Number.MAX_SAFE_INTEGER;
		const bOrder = b.firstMaxSetOrder ?? Number.MAX_SAFE_INTEGER;
		if (aOrder !== bOrder) {
			return aOrder - bOrder;
		}
		return compareStringIdsAsc(a.sponsorId, b.sponsorId);
	});
}

export function resolveProxyState<TSponsorId extends string>(
	contenders: ProxyContender<TSponsorId>[],
	startPriceCents: number,
): ProxyState<TSponsorId> | null {
	const ordered = sortProxyContenders(contenders);
	const leader = ordered[0];
	if (!leader) return null;

	const runnerUp = ordered[1] ?? null;
	const runnerUpMaxCents = runnerUp?.maxAmountCents ?? null;

	if (runnerUp === null) {
		return {
			currentPriceCents: startPriceCents,
			leaderSponsorId: leader.sponsorId,
			leaderMaxCents: leader.maxAmountCents,
			runnerUpMaxCents: null,
		};
	}

	const runnerUpNext =
		runnerUp.maxAmountCents + incrementForEbayDeEur(runnerUp.maxAmountCents);
	return {
		currentPriceCents: Math.max(
			startPriceCents,
			Math.min(leader.maxAmountCents, runnerUpNext),
		),
		leaderSponsorId: leader.sponsorId,
		leaderMaxCents: leader.maxAmountCents,
		runnerUpMaxCents,
	};
}

export function resolveSealedOutcome<
	TSponsorId extends string,
	TIntentId extends string,
>(
	intents: SealedBidIntent<TSponsorId, TIntentId>[],
	options?: SealedResolutionOptions,
): SealedOutcome<TSponsorId, TIntentId> | null {
	const latestIntentBySponsorId = new Map<
		TSponsorId,
		SealedBidIntent<TSponsorId, TIntentId>
	>();
	const intentsInChronologicalOrder = [...intents].sort((a, b) =>
		compareSealedIntentChronology(
			a as SealedBidIntent<string, string>,
			b as SealedBidIntent<string, string>,
		),
	);
	for (const intent of intentsInChronologicalOrder) {
		latestIntentBySponsorId.set(intent.sponsorId, intent);
	}
	const contenders = [...latestIntentBySponsorId.values()].sort((a, b) => {
		if (b.amountCents !== a.amountCents) return b.amountCents - a.amountCents;
		if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
		if (a.createdOrder !== b.createdOrder)
			return a.createdOrder - b.createdOrder;
		const sponsorCompare = compareStringIdsAsc(a.sponsorId, b.sponsorId);
		if (sponsorCompare !== 0) return sponsorCompare;
		return compareStringIdsAsc(a.intentId, b.intentId);
	});
	const leader = contenders[0];
	if (!leader) return null;
	const pricing = options?.pricing ?? "first_price";
	const reservePriceCents = options?.reservePriceCents ?? 0;
	const runnerUpBidCents = contenders[1]?.amountCents;
	const settlementBidCents =
		pricing === "second_price"
			? Math.max(reservePriceCents, runnerUpBidCents ?? reservePriceCents)
			: leader.amountCents;
	return {
		leaderSponsorId: leader.sponsorId,
		leaderIntentId: leader.intentId,
		leaderBidCents: leader.amountCents,
		settlementBidCents,
	};
}
