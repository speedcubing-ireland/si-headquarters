import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

type EventGridEvent = {
	eventType?: string;
	data?: unknown;
};

type SubscriptionValidationEventData = {
	validationCode?: string;
};

type EmailDeliveryReportReceivedData = {
	messageId?: string;
	status?: string;
	deliveryStatusDetails?: { statusMessage?: string };
};

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let res = 0;
	for (let i = 0; i < a.length; i += 1) {
		res |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return res === 0;
}

function getWebhookToken(url: string): string | null {
	try {
		const u = new URL(url);
		const token = u.searchParams.get("token");
		return token?.trim() ? token.trim() : null;
	} catch {
		return null;
	}
}

export const handleAzureEmailEvents = httpAction(async (ctx, req) => {
	const expected = process.env.EVENT_GRID_WEBHOOK_SECRET?.trim() ?? "";
	const got = getWebhookToken(req.url);
	if (!expected || !got || !constantTimeEqual(expected, got)) {
		return new Response("Unauthorized", { status: 401 });
	}

	const body = (await req.json()) as unknown;
	const events: EventGridEvent[] = Array.isArray(body)
		? (body as EventGridEvent[])
		: [];
	if (events.length === 0) {
		return new Response("Bad Request", { status: 400 });
	}

	for (const evt of events) {
		if (evt.eventType === "Microsoft.EventGrid.SubscriptionValidationEvent") {
			const data = (evt.data ?? {}) as SubscriptionValidationEventData;
			const validationCode = data.validationCode?.toString();
			if (!validationCode) {
				return new Response("Bad Request", { status: 400 });
			}
			return Response.json({ validationResponse: validationCode });
		}
	}

	for (const evt of events) {
		if (evt.eventType !== "Microsoft.Communication.EmailDeliveryReportReceived")
			continue;
		const data = (evt.data ?? {}) as EmailDeliveryReportReceivedData;
		const providerOperationId = data.messageId?.toString();
		const providerStatus = data.status?.toString();
		const statusMessage = data.deliveryStatusDetails?.statusMessage?.toString();
		if (!providerOperationId || !providerStatus) continue;

		await ctx.runMutation(internal.emailQueue._applyDeliveryEvent, {
			providerOperationId,
			providerStatus,
			statusMessage,
		});
	}

	return new Response("OK", { status: 200 });
});
