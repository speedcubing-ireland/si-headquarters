import type { NotificationPayload } from "./notificationTypes";

export function serializePayload(payload: NotificationPayload): string {
	return JSON.stringify(payload);
}

export function parsePayloadJson(
	payloadJson: string | undefined,
): NotificationPayload {
	if (!payloadJson) {
		return {};
	}
	try {
		const value = JSON.parse(payloadJson);
		return typeof value === "object" && value !== null ? value : {};
	} catch {
		return {};
	}
}
