import type { Id } from "../../_generated/dataModel";
import type { NotificationType } from "../lib/notificationTypes";
import { buildEntityLink, formatEntityTypeLabel } from "../../emails/shared";
import { buildDeterministicEmailOperationId } from "../../lib/email";
import { buildTestEmailData } from "../lib/notificationEmail";
import type { ChannelSendResult, NotificationChannelAdapter } from "./base";

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

const EMAIL_SEND_POLL_INTERVAL_MS = 15_000;
const EMAIL_SEND_TRANSIENT_RETRY_MS = 30_000;

function buildEmailOperationId(payload: EmailDispatchGroupPayload): string {
	const stableDispatchIds = [...payload.dispatchIds].sort();
	const seed = [
		"notifications",
		payload.digestMode,
		payload.digestWindowKey ?? "",
		payload.recipientEmail.toLowerCase(),
		stableDispatchIds.join(","),
		String(payload.items.length),
	].join("|");
	return buildDeterministicEmailOperationId(seed);
}

async function sendEmailPayload(
	payload: EmailDispatchGroupPayload,
	operationId: string,
): Promise<{
	operationId: string;
	status: string;
	retryAfterMs: number;
	error?: string;
}> {
	const { pollEmailSend } = await import("../../lib/email");
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
		return await pollEmailSend({
			to,
			subject: buildNotificationEmailSubject(itemType, firstItem.title),
			html: await buildNotificationEmailHtml(emailContent),
			plainText: await buildNotificationEmailPlainText(emailContent),
			operationId,
			updateIntervalInMs: EMAIL_SEND_POLL_INTERVAL_MS,
		});
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
	return await pollEmailSend({
		to,
		subject: buildNotificationDigestEmailSubject(
			payload.digestMode,
			payload.items.length,
		),
		html: await buildNotificationDigestEmailHtml(digestOpts),
		plainText: await buildNotificationDigestEmailPlainText(digestOpts),
		operationId,
		updateIntervalInMs: EMAIL_SEND_POLL_INTERVAL_MS,
	});
}

function toChannelResultFromProgress(progress: {
	status: string;
	retryAfterMs: number;
	error?: string;
}): ChannelSendResult {
	if (progress.status === "Succeeded") {
		return { status: "sent" };
	}
	if (progress.status === "Failed" || progress.status === "Canceled") {
		return {
			status: "failed",
			error: progress.error ?? "email_send_terminal_failure",
		};
	}
	return {
		status: "in_progress",
		retryAfterMs: progress.retryAfterMs,
		reason: progress.error,
	};
}

export const emailChannelAdapter: NotificationChannelAdapter<EmailDispatchGroupPayload> =
	{
		channel: "email",
		isConfigured: () =>
			Boolean(process.env.AZURE_EMAIL_CONNECTION_STRING?.trim()) &&
			Boolean(process.env.EMAIL_SENDER_ADDRESS?.trim()),
		send: async (payload) => {
			const operationId = buildEmailOperationId(payload);
			try {
				const progress = await sendEmailPayload(payload, operationId);
				return toChannelResultFromProgress(progress);
			} catch (error) {
				const {
					emailErrorMessage,
					isTransientEmailTransportError,
					pollEmailSendOperation,
				} = await import("../../lib/email");
				const errorMessage = emailErrorMessage(error);
				if (isTransientEmailTransportError(error)) {
					try {
						const progress = await pollEmailSendOperation(operationId);
						return toChannelResultFromProgress(progress);
					} catch (pollError) {
						if (isTransientEmailTransportError(pollError)) {
							return {
								status: "in_progress",
								retryAfterMs: EMAIL_SEND_TRANSIENT_RETRY_MS,
								reason: errorMessage,
							};
						}
						return {
							status: "failed",
							error: emailErrorMessage(pollError),
						};
					}
				}
				return {
					status: "failed",
					error: errorMessage,
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
