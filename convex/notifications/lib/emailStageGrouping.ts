import type { Id } from "../../_generated/dataModel";

export type NotificationEmailStageGroupArgs = {
	userId: Id<"users">;
	digestMode: "immediate" | "hourly" | "daily" | "three_daily";
	digestWindowKey?: string;
};

export function isQuietHoursDigestWindowKey(
	digestWindowKey: string | undefined,
): boolean {
	return digestWindowKey?.startsWith("quiet:") ?? false;
}

export function resolveStageDigestWindowKey(args: {
	digestMode: "immediate" | "hourly" | "daily" | "three_daily";
	stageKey: string;
	scheduledDigestWindowKey: string | undefined;
}): string | undefined {
	if (args.digestMode !== "immediate") {
		return args.scheduledDigestWindowKey;
	}
	if (isQuietHoursDigestWindowKey(args.scheduledDigestWindowKey)) {
		return args.scheduledDigestWindowKey;
	}
	return args.stageKey;
}

export function buildNotificationGroupSourceRef(args: {
	userId: Id<"users">;
	digestMode: "immediate" | "hourly" | "daily" | "three_daily";
	digestWindowKey?: string;
}): string {
	return `notification_group:${args.userId}:${args.digestMode}:${args.digestWindowKey ?? "immediate"}`;
}
