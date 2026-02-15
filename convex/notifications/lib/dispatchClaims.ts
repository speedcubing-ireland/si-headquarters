import type { NotificationChannel } from "./notificationTypes";

export const DISPATCH_GROUP_CLAIM_PREFIX = "dispatch_group_claim:";

export type DispatchGroupClaim = {
	channel: NotificationChannel;
	timestamp: number;
	seedDispatchId: string;
};

export function parseDispatchGroupClaimInfo(
	claimKey: string | undefined,
): DispatchGroupClaim | null {
	if (!claimKey || !claimKey.startsWith(DISPATCH_GROUP_CLAIM_PREFIX)) {
		return null;
	}
	const token = claimKey.slice(DISPATCH_GROUP_CLAIM_PREFIX.length);
	const [channelRaw, timestampRaw, seedDispatchId] = token.split(":");
	if (!seedDispatchId || !timestampRaw) {
		return null;
	}
	const timestamp = Number(timestampRaw);
	if (!Number.isFinite(timestamp)) {
		return null;
	}
	if (
		channelRaw !== "in_app" &&
		channelRaw !== "email" &&
		channelRaw !== "slack" &&
		channelRaw !== "push"
	) {
		return null;
	}
	return {
		channel: channelRaw,
		timestamp,
		seedDispatchId,
	};
}

export function hasDispatchGroupClaim(reason: string | undefined): boolean {
	return parseDispatchGroupClaimInfo(reason) !== null;
}

export function buildDispatchGroupClaimKey(
	channel: NotificationChannel,
	now: number,
	seedDispatchId: string,
): string {
	return `${DISPATCH_GROUP_CLAIM_PREFIX}${channel}:${now}:${seedDispatchId}`;
}
