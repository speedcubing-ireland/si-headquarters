import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { PRIORITY_LABELS, STATUS_LABELS } from "../../lib/constants";
import type { DiscordNotificationContext } from "./context";

export function truncateDiscordPreview(
	value: string | undefined,
	maxLength = 220,
): string {
	const trimmed = value?.trim();
	if (!trimmed) return "";
	if (trimmed.length <= maxLength) return trimmed;
	return `${trimmed.slice(0, maxLength - 1).trimEnd()}...`;
}

export function labelForStatus(status: string | undefined): string {
	return status ? (STATUS_LABELS[status] ?? status) : "Unknown";
}

export function labelForPriority(priority: string | undefined): string {
	return priority ? (PRIORITY_LABELS[priority] ?? priority) : "Unknown";
}

export function progressStatusIcon(status: string | undefined): string {
	if (status === "on-track") return ":green_circle:";
	if (status === "at-risk") return ":yellow_circle:";
	if (status === "off-track") return ":red_circle:";
	return ":blue_circle:";
}

export function taskDescription(context: DiscordNotificationContext): string {
	const task = requireTask(context);
	return `**${task.identifier}: ${task.title}**`;
}

export function requireTask(context: DiscordNotificationContext) {
	if (!context.task) {
		throw new Error(
			`Discord notification ${context.input.type} requires a task context.`,
		);
	}
	return context.task;
}

export function optionalPayloadString(
	context: DiscordNotificationContext,
	key: string,
): string | undefined {
	const value = context.payload[key];
	return typeof value === "string" ? value : undefined;
}

export function optionalPayloadNumber(
	context: DiscordNotificationContext,
	key: string,
): number | undefined {
	const value = context.payload[key];
	return typeof value === "number" ? value : undefined;
}

export function normalizePayloadTaskId(
	ctx: Pick<MutationCtx, "db">,
	value: unknown,
): Id<"tasks"> | null {
	return typeof value === "string" ? ctx.db.normalizeId("tasks", value) : null;
}
