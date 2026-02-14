import { buildTestEmailData } from "./notificationEmail";
import { buildNotificationGroupEmailContent } from "./emailDispatchComposer";

export type SendTestEmailPreviewArgs = {
	type: "immediate" | "hourly" | "three_daily";
	toEmail: string;
	recipientName?: string;
	actorName: string;
};

export async function sendTestEmailPreview(
	args: SendTestEmailPreviewArgs,
): Promise<void> {
	const { sendEmail } = await import("../../lib/email");

	const appUrl = process.env.SITE_URL ?? "https://hq.speedcubing.ie";
	const testData = buildTestEmailData(appUrl, args.actorName);
	const to = [
		{
			address: args.toEmail,
			displayName: args.recipientName,
		},
	];

	if (args.type === "immediate") {
		const content = await buildNotificationGroupEmailContent({
			digestMode: "immediate",
			appUrl,
			items: [{ ...testData.immediate, type: "task_assigned" }],
		});
		await sendEmail({
			to,
			subject: `[HQ TEST] ${content.subject}`,
			html: content.htmlBody,
			plainText: content.plainTextBody,
		});
		return;
	}

	const mode =
		args.type === "hourly" ? ("hourly" as const) : ("three_daily" as const);
	const items = args.type === "hourly" ? testData.hourly : testData.threeDaily;
	const content = await buildNotificationGroupEmailContent({
		digestMode: mode,
		appUrl,
		items,
	});
	await sendEmail({
		to,
		subject: `[HQ TEST] ${content.subject}`,
		html: content.htmlBody,
		plainText: content.plainTextBody,
	});
}
