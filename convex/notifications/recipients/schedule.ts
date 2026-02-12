import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { computeDispatchSchedule } from "../../lib/notificationScheduling";
import { getNotificationUserTimezone } from "../../lib/notificationSettings";
import type { NotificationPreferenceConfig } from "../../lib/notificationTypes";

export async function computeInAppScheduleForRecipient(
	ctx: Pick<MutationCtx, "db">,
	recipientId: Id<"users">,
	inAppPreference: NotificationPreferenceConfig,
) {
	const now = Date.now();
	const timezone = await getNotificationUserTimezone(ctx, recipientId);
	return computeDispatchSchedule({
		now,
		timezone,
		digestMode: inAppPreference.digestMode,
		quietHoursStartMin: inAppPreference.quietHoursStartMin,
		quietHoursEndMin: inAppPreference.quietHoursEndMin,
	});
}
