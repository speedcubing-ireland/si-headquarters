import type { Id } from "../../_generated/dataModel";
import type { NotificationType } from "../lib/notificationTypes";
import { buildEntityLink, formatEntityTypeLabel } from "../../emails/shared";
import { buildTestEmailData } from "../lib/notificationEmail";
import type { NotificationChannelAdapter } from "./base";

type EmailDispatchItem = {
	dispatchId: Id<"notificationDispatches">;
	type: NotificationType;
	title: string;
	message: string;
	body?: string;
	entityType: string;
	entityId: string;
	parentEntityId?: string;
	priority: string;
	actorName?: string;
};

export type EmailDispatchGroupPayload = {
	dispatchIds: Id<"notificationDispatches">[];
	digestMode: "immediate" | "hourly" | "daily" | "three_daily";
	digestWindowKey?: string;
	recipientEmail: string;
	recipientName?: string;
	items: EmailDispatchItem[];
};

export type SendTestEmailPreviewArgs = {
	type: "immediate" | "hourly" | "three_daily";
	toEmail: string;
	recipientName?: string;
	actorName: string;
};

async function sendEmailPayload(
	payload: EmailDispatchGroupPayload,
): Promise<void> {
	const { sendEmail } = await import("../../lib/email");
	const {
		buildNotificationDigestEmailHtml,
		buildNotificationDigestEmailPlainText,
		buildNotificationDigestEmailSubject,
		buildNotificationEmailHtml,
		buildNotificationEmailPlainText,
		buildNotificationEmailSubject,
	} = await import("../lib/emailTemplates");

	const appUrl = process.env.SITE_URL ?? "https://hq.speedcubing.ie";
	const firstItem = payload.items[0];
	if (!firstItem) {
		throw new Error("email_dispatch_payload_empty");
	}

	const to = [
		{
			address: payload.recipientEmail,
			displayName: payload.recipientName,
		},
	];

	if (payload.digestMode === "immediate") {
		const {
			dispatchId: _dispatchId,
			type: itemType,
			...emailItemData
		} = firstItem;
		const emailContent = { ...emailItemData, appUrl };
		await sendEmail({
			to,
			subject: buildNotificationEmailSubject(itemType, firstItem.title),
			html: await buildNotificationEmailHtml(emailContent),
			plainText: await buildNotificationEmailPlainText(emailContent),
		});
		return;
	}

	const digestItems = payload.items.map((item) => ({
		title: item.title,
		message: item.message,
		entityType: formatEntityTypeLabel(item.entityType),
		priority: item.priority,
		actorName: item.actorName,
		link: buildEntityLink(appUrl, item),
	}));
	const digestOpts = {
		mode: payload.digestMode,
		appUrl,
		items: digestItems,
	};
	await sendEmail({
		to,
		subject: buildNotificationDigestEmailSubject(
			payload.digestMode,
			payload.items.length,
		),
		html: await buildNotificationDigestEmailHtml(digestOpts),
		plainText: await buildNotificationDigestEmailPlainText(digestOpts),
	});
}

export const emailChannelAdapter: NotificationChannelAdapter<EmailDispatchGroupPayload> =
	{
		channel: "email",
		isConfigured: () => true,
		send: async (payload) => {
			try {
				await sendEmailPayload(payload);
				return { ok: true };
			} catch (error) {
				return {
					ok: false,
					error:
						error instanceof Error ? error.message : "unknown_email_send_error",
				};
			}
		},
	};

export async function sendTestEmailPreview(
	args: SendTestEmailPreviewArgs,
): Promise<void> {
	const { sendEmail } = await import("../../lib/email");
	const {
		buildNotificationEmailHtml,
		buildNotificationEmailPlainText,
		buildNotificationEmailSubject,
		buildNotificationDigestEmailHtml,
		buildNotificationDigestEmailPlainText,
		buildNotificationDigestEmailSubject,
	} = await import("../lib/emailTemplates");

	const appUrl = process.env.SITE_URL ?? "https://hq.speedcubing.ie";
	const testData = buildTestEmailData(appUrl, args.actorName);
	const to = [
		{
			address: args.toEmail,
			displayName: args.recipientName,
		},
	];

	if (args.type === "immediate") {
		const item = testData.immediate;
		await sendEmail({
			to,
			subject: `[HQ TEST] ${buildNotificationEmailSubject("task_assigned", item.title)}`,
			html: await buildNotificationEmailHtml({ ...item, appUrl }),
			plainText: await buildNotificationEmailPlainText({ ...item, appUrl }),
		});
		return;
	}

	const mode =
		args.type === "hourly" ? ("hourly" as const) : ("three_daily" as const);
	const items = args.type === "hourly" ? testData.hourly : testData.threeDaily;
	await sendEmail({
		to,
		subject: `[HQ TEST] ${buildNotificationDigestEmailSubject(mode, items.length)}`,
		html: await buildNotificationDigestEmailHtml({ mode, appUrl, items }),
		plainText: await buildNotificationDigestEmailPlainText({
			mode,
			appUrl,
			items,
		}),
	});
}
