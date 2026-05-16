import { verifyKey } from "discord-interactions";
import {
	ButtonStyle,
	ComponentType,
	InteractionResponseType,
	InteractionType,
	TextInputStyle,
	type APIApplicationCommandInteraction,
	type APIInteraction,
	type APIInteractionResponse,
	type APIInteractionResponseCallbackData,
	type APIMessageComponentInteraction,
	type APIModalSubmitInteraction,
	type APIPingInteraction,
	type RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";

export type DiscordInteractionRequest = {
	rawBody: string;
	signature: string | null;
	timestamp: string | null;
};

export const HQ_COMPETITIONS_COUNT_BUTTON_ID = "hq:competitions:count";
export const HQ_ACTION_TOKEN_PREFIX = "hqa:";
export const HQ_ACTION_MODAL_PREFIX = "hqm:";
export const HQ_ACTION_MODAL_FIELD_ID = "message";

type DiscordMessageData = APIInteractionResponseCallbackData &
	RESTPostAPIChannelMessageJSONBody;

export async function verifyDiscordInteractionRequest(
	request: DiscordInteractionRequest,
	publicKey: string,
): Promise<boolean> {
	if (!request.signature || !request.timestamp) {
		return false;
	}

	return verifyKey(
		request.rawBody,
		request.signature,
		request.timestamp,
		publicKey,
	);
}

export function parseDiscordInteraction(rawBody: string): APIInteraction {
	return JSON.parse(rawBody) as APIInteraction;
}

export function interactionPongResponse(): APIInteractionResponse {
	return { type: InteractionResponseType.Pong };
}

export function interactionMessageResponse(
	data: APIInteractionResponseCallbackData,
	options?: { ephemeral?: boolean },
): APIInteractionResponse {
	return {
		type: InteractionResponseType.ChannelMessageWithSource,
		data: {
			...data,
			flags: options?.ephemeral ? 64 : data.flags,
		},
	};
}

export function interactionUpdateMessageResponse(
	data: APIInteractionResponseCallbackData,
): APIInteractionResponse {
	return {
		type: InteractionResponseType.UpdateMessage,
		data,
	};
}

export function interactionModalResponse(args: {
	customId: string;
	title: string;
	label: string;
	placeholder?: string;
	value?: string;
}): APIInteractionResponse {
	return {
		type: InteractionResponseType.Modal,
		data: {
			custom_id: args.customId,
			title: args.title,
			components: [
				{
					type: ComponentType.ActionRow,
					components: [
						{
							type: ComponentType.TextInput,
							custom_id: HQ_ACTION_MODAL_FIELD_ID,
							style: TextInputStyle.Paragraph,
							label: args.label,
							placeholder: args.placeholder,
							value: args.value,
							required: true,
							max_length: 2000,
						},
					],
				},
			],
		},
	};
}

export function getModalTextValue(
	interaction: APIModalSubmitInteraction,
	fieldId: string = HQ_ACTION_MODAL_FIELD_ID,
): string | null {
	for (const row of interaction.data.components) {
		if (!("components" in row)) continue;
		for (const component of row.components) {
			if (
				component.type === ComponentType.TextInput &&
				component.custom_id === fieldId
			) {
				return component.value ?? null;
			}
		}
	}
	return null;
}

export function buildCompetitionCountMessage(
	competitionCount?: number,
): DiscordMessageData {
	const description =
		typeof competitionCount === "number"
			? `Headquarters currently has **${competitionCount}** competitions.`
			: "Press the button below to fetch the current competition total from Headquarters.";

	return {
		content: "Headquarters Discord integration",
		embeds: [
			{
				title:
					typeof competitionCount === "number"
						? "Competition total"
						: "Interactive HQ controls",
				description,
				color: 0x5865f2,
			},
		],
		components: [
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.Button,
						style: ButtonStyle.Primary,
						label:
							typeof competitionCount === "number"
								? "Refresh competition count"
								: "Fetch competition count",
						custom_id: HQ_COMPETITIONS_COUNT_BUTTON_ID,
					},
				],
			},
		],
	};
}

export function isPingInteraction(
	interaction: APIInteraction,
): interaction is APIPingInteraction {
	return interaction.type === InteractionType.Ping;
}

export function isChatInputCommand(
	interaction: APIInteraction,
): interaction is APIApplicationCommandInteraction {
	return interaction.type === InteractionType.ApplicationCommand;
}

export function isMessageComponent(
	interaction: APIInteraction,
): interaction is APIMessageComponentInteraction {
	return interaction.type === InteractionType.MessageComponent;
}

export function isModalSubmitInteraction(
	interaction: APIInteraction,
): interaction is APIModalSubmitInteraction {
	return interaction.type === InteractionType.ModalSubmit;
}
