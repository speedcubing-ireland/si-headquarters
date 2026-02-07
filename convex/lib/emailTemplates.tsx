import { render } from "@react-email/components";
import NotificationEmail from "../emails/NotificationEmail";
import NotificationDigestEmail from "../emails/NotificationDigestEmail";
import type {
	NOTIFICATION_DIGEST_MODES,
	NOTIFICATION_TYPES,
} from "./validators";

type NotificationType = (typeof NOTIFICATION_TYPES)[number];
type NotificationDigestMode = (typeof NOTIFICATION_DIGEST_MODES)[number];
type BatchDigestMode = Exclude<NotificationDigestMode, "immediate">;

export type EmailTemplateInput = {
	title: string;
	message: string;
	body?: string;
	entityType: string;
	entityId: string;
	parentEntityId?: string;
	actorName?: string;
	priority: string;
	appUrl: string;
};

export type DigestEmailItemInput = {
	title: string;
	message: string;
	entityType: string;
	priority: string;
	actorName?: string;
	link: string;
};

export type DigestEmailTemplateInput = {
	mode: BatchDigestMode;
	items: DigestEmailItemInput[];
	appUrl: string;
};

export function buildNotificationEmailSubject(
	_type: NotificationType,
	title: string,
): string {
	return `[HQ] ${title}`;
}

export function buildNotificationDigestEmailSubject(
	mode: BatchDigestMode,
	itemCount: number,
): string {
	const countText = `${itemCount} ${itemCount === 1 ? "update" : "updates"}`;
	switch (mode) {
		case "hourly":
			return `[HQ] Hourly digest: ${countText}`;
		case "daily":
			return `[HQ] Daily digest: ${countText}`;
		case "three_daily":
			return `[HQ] 3x daily digest: ${countText}`;
	}
}

export async function buildNotificationEmailPlainText(
	input: EmailTemplateInput,
): Promise<string> {
	return render(<NotificationEmail {...input} />, { plainText: true });
}

export async function buildNotificationEmailHtml(
	input: EmailTemplateInput,
): Promise<string> {
	return render(<NotificationEmail {...input} />);
}

export async function buildNotificationDigestEmailPlainText(
	input: DigestEmailTemplateInput,
): Promise<string> {
	return render(<NotificationDigestEmail {...input} />, { plainText: true });
}

export async function buildNotificationDigestEmailHtml(
	input: DigestEmailTemplateInput,
): Promise<string> {
	return render(<NotificationDigestEmail {...input} />);
}
