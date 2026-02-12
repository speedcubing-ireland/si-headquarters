import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { getEntitySubscriberIds } from "../../lib/notificationAccess";
import type { NotificationEmitInput } from "../../lib/notificationTypes";

export async function expandRecipientIds(
	ctx: Pick<MutationCtx, "db">,
	input: Pick<
		NotificationEmitInput,
		"recipients" | "includeEntitySubscribers" | "entity"
	>,
): Promise<Id<"users">[]> {
	const recipientSet = new Set<Id<"users">>(input.recipients);
	if (input.includeEntitySubscribers) {
		const subscribers = await getEntitySubscriberIds(ctx, input.entity);
		for (const subscriberId of subscribers) {
			recipientSet.add(subscriberId);
		}
	}
	return [...recipientSet];
}
