import type { Id } from "../../_generated/dataModel";
import { buildEntityLink, formatEntityTypeLabel } from "../../emails/shared";
import type { NotificationType } from "./notificationTypes";
import {
	buildNotificationDigestEmailHtml,
	buildNotificationDigestEmailPlainText,
	buildNotificationDigestEmailSubject,
	buildNotificationEmailHtml,
	buildNotificationEmailPlainText,
	buildNotificationEmailSubject,
} from "./emailTemplates";

export type NotificationEmailGroupItem = {
	type?: NotificationType;
	title: string;
	message: string;
	body?: string;
	entityType: string;
	entityId?: string;
	parentEntityId?: string;
	priority: string;
	actorName?: string;
	link?: string;
};

export type NotificationGroupEmailContent = {
	emailType: "notification_immediate" | "notification_digest";
	subject: string;
	htmlBody: string;
	plainTextBody: string;
};

export async function buildNotificationGroupEmailContent(args: {
	digestMode: "immediate" | "hourly" | "daily" | "three_daily";
	items: NotificationEmailGroupItem[];
	appUrl: string;
}): Promise<NotificationGroupEmailContent> {
	if (args.digestMode === "immediate") {
		const firstItem = args.items[0];
		if (!firstItem) {
			throw new Error("email_dispatch_payload_empty");
		}
		if (!firstItem.type) {
			throw new Error("email_dispatch_type_missing");
		}
		if (!firstItem.entityId) {
			throw new Error("email_dispatch_entity_id_missing");
		}
		const subject = buildNotificationEmailSubject(
			firstItem.type,
			firstItem.title,
		);
		const immediateContent = {
			title: firstItem.title,
			message: firstItem.message,
			body: firstItem.body,
			entityType: firstItem.entityType,
			entityId: firstItem.entityId,
			parentEntityId: firstItem.parentEntityId,
			actorName: firstItem.actorName,
			priority: firstItem.priority,
			appUrl: args.appUrl,
		};
		const [htmlBody, plainTextBody] = await Promise.all([
			buildNotificationEmailHtml(immediateContent),
			buildNotificationEmailPlainText(immediateContent),
		]);
		return {
			emailType: "notification_immediate",
			subject,
			htmlBody,
			plainTextBody,
		};
	}

	const digestItems = args.items.map((item) => ({
		title: item.title,
		message: item.message,
		entityType: item.entityType,
		priority: item.priority,
		actorName: item.actorName,
		link: item.link,
	}));
	if (digestItems.some((item) => !item.link)) {
		throw new Error("email_dispatch_link_missing");
	}
	const typedDigestItems = digestItems as Array<{
		title: string;
		message: string;
		entityType: string;
		priority: string;
		actorName?: string;
		link: string;
	}>;
	const subject = buildNotificationDigestEmailSubject(
		args.digestMode,
		typedDigestItems.length,
	);
	const [htmlBody, plainTextBody] = await Promise.all([
		buildNotificationDigestEmailHtml({
			mode: args.digestMode,
			appUrl: args.appUrl,
			items: typedDigestItems,
		}),
		buildNotificationDigestEmailPlainText({
			mode: args.digestMode,
			appUrl: args.appUrl,
			items: typedDigestItems,
		}),
	]);
	return {
		emailType: "notification_digest",
		subject,
		htmlBody,
		plainTextBody,
	};
}

export function mapDispatchItemsToEmailGroupItems(args: {
	appUrl: string;
	items: Array<{
		type: NotificationType;
		title: string;
		message: string;
		body?: string;
		entityType: string;
		entityId: string;
		parentEntityId?: string;
		priority: string;
		actorName?: string;
	}>;
}): NotificationEmailGroupItem[] {
	return args.items.map((item) => ({
		type: item.type,
		title: item.title,
		message: item.message,
		body: item.body,
		entityType: formatEntityTypeLabel(item.entityType),
		entityId: item.entityId,
		parentEntityId: item.parentEntityId,
		priority: item.priority,
		actorName: item.actorName,
		link: buildEntityLink(args.appUrl, item),
	}));
}

export function buildNotificationGroupIdempotencyKey(args: {
	digestMode: "immediate" | "hourly" | "daily" | "three_daily";
	digestWindowKey?: string;
	recipientEmail: string;
	dispatchIds: Id<"notificationDispatches">[];
}): string {
	const stableDispatchIds = [...args.dispatchIds].sort();
	return [
		"notification_group",
		args.digestMode,
		args.digestWindowKey ?? "",
		args.recipientEmail.toLowerCase(),
		stableDispatchIds.join(","),
	].join("|");
}
