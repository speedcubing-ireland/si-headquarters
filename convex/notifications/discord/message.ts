import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { NotificationEmitInput } from "../lib/notificationTypes";
import { viewEntityAction, withDestinationLimits } from "./actions";
import { buildDiscordNotificationContext } from "./context";
import { discordNotificationRegistry } from "./registry";
import type { DiscordDestinationKind, DiscordMessagePayload } from "./types";

export async function buildDiscordMessagePayload(
	ctx: MutationCtx,
	args: {
		input: NotificationEmitInput;
		destinationKind: DiscordDestinationKind;
		userId?: Id<"users">;
	},
): Promise<DiscordMessagePayload> {
	const context = await buildDiscordNotificationContext(ctx, args);
	const definition = discordNotificationRegistry[args.input.type];
	const embed = await definition.buildEmbed(context);
	const definitionActions = definition.buildActions
		? await definition.buildActions(context)
		: [];
	const actions = await withDestinationLimits(context, [
		...viewEntityAction(context, definition.viewLabel),
		...definitionActions,
	]);

	return {
		...embed,
		message: args.input.message,
		url: context.entityUrl,
		actions,
		priority: args.input.priority as "urgent" | "high" | "normal" | undefined,
	};
}
