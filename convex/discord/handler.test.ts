import { describe, expect, it, vi } from "vitest";
import {
	type APIApplicationCommandInteraction,
	ComponentType,
	InteractionType,
	Locale,
	type APIMessageComponentInteraction,
	type APIUser,
} from "discord-api-types/v10";
import { handleDiscordInteraction } from "./handler";
import {
	HQ_ACTION_TOKEN_PREFIX,
	HQ_COMPETITIONS_COUNT_BUTTON_ID,
} from "./interactions";

const testUser: APIUser = {
	id: "123",
	username: "tester",
	discriminator: "0001",
	avatar: null,
	global_name: "Tester",
};

describe("handleDiscordInteraction", () => {
	it("sends the interactive HQ DM for the dmhq command", async () => {
		const runAction = vi.fn(
			async (_reference: unknown, _args: { userId: string }) => ({
				messageId: "message-1",
				channelId: "channel-1",
			}),
		);
		const interaction = {
			id: "interaction-1",
			application_id: "app-1",
			type: InteractionType.ApplicationCommand,
			token: "token",
			version: 1,
			locale: Locale.EnglishUS,
			authorizing_integration_owners: {},
			attachment_size_limit: 0,
			data: {
				id: "command-1",
				name: "dmhq",
				type: 1,
			},
			channel_id: "channel-1",
			guild_id: "guild-1",
			member: {
				user: testUser,
				roles: [],
				premium_since: null,
				permissions: "0",
				pending: false,
				deaf: false,
				mute: false,
				flags: 1 as never,
				joined_at: new Date().toISOString(),
			},
			app_permissions: "0",
			entitlements: [],
		} as unknown as APIApplicationCommandInteraction;

		const response = await handleDiscordInteraction(
			{ runAction, runQuery: vi.fn() } as never,
			interaction,
		);

		expect(runAction).toHaveBeenCalledOnce();
		expect(runAction.mock.calls[0]?.[1]).toEqual({ userId: testUser.id });

		const body = await response.json();
		expect(body.type).toBe(4);
		expect(body.data.content).toContain("interactive Headquarters DM");
		expect(body.data.flags).toBe(64);
	});

	it("updates the message with the competition count for button clicks", async () => {
		const runQuery = vi.fn(async () => 27);
		const interaction = {
			id: "interaction-2",
			application_id: "app-1",
			type: InteractionType.MessageComponent,
			token: "token",
			version: 1,
			locale: Locale.EnglishUS,
			authorizing_integration_owners: {},
			attachment_size_limit: 0,
			channel_id: "channel-1",
			data: {
				component_type: ComponentType.Button,
				custom_id: HQ_COMPETITIONS_COUNT_BUTTON_ID,
			},
			message: {
				id: "message-1",
				channel_id: "channel-1",
				author: {
					id: "bot-1",
					username: "hq-bot",
					discriminator: "0001",
					avatar: null,
					global_name: "HQ Bot",
				},
				content: "Headquarters Discord integration",
				timestamp: new Date().toISOString(),
				edited_timestamp: null,
				tts: false,
				mention_everyone: false,
				mentions: [],
				mention_roles: [],
				attachments: [],
				embeds: [],
				pinned: false,
				type: 0,
			},
			user: testUser,
			app_permissions: "0",
			entitlements: [],
		} as unknown as APIMessageComponentInteraction;

		const response = await handleDiscordInteraction(
			{ runAction: vi.fn(), runQuery } as never,
			interaction,
		);

		expect(runQuery).toHaveBeenCalledOnce();

		const body = await response.json();
		expect(body.type).toBe(7);
		expect(body.data.embeds[0].description).toContain("27");
		expect(body.data.components[0].components[0].custom_id).toBe(
			HQ_COMPETITIONS_COUNT_BUTTON_ID,
		);
	});

	it("executes Discord action tokens and clears the message buttons", async () => {
		const runMutation = vi.fn(
			async (
				_reference: unknown,
				_args: { token: string; discordUserId: string },
			) => ({
				content: "Task moved to done.",
				clearMessage: true,
			}),
		);
		const interaction = {
			id: "interaction-3",
			application_id: "app-1",
			type: InteractionType.MessageComponent,
			token: "token",
			version: 1,
			locale: Locale.EnglishUS,
			authorizing_integration_owners: {},
			attachment_size_limit: 0,
			channel_id: "channel-1",
			data: {
				component_type: ComponentType.Button,
				custom_id: `${HQ_ACTION_TOKEN_PREFIX}token-123`,
			},
			message: {
				id: "message-2",
				channel_id: "channel-1",
				author: {
					id: "bot-1",
					username: "hq-bot",
					discriminator: "0001",
					avatar: null,
					global_name: "HQ Bot",
				},
				content: "Task assigned",
				timestamp: new Date().toISOString(),
				edited_timestamp: null,
				tts: false,
				mention_everyone: false,
				mentions: [],
				mention_roles: [],
				attachments: [],
				embeds: [],
				components: [
					{
						type: ComponentType.ActionRow,
						components: [
							{
								type: ComponentType.Button,
								style: 1,
								label: "Done",
								custom_id: `${HQ_ACTION_TOKEN_PREFIX}token-123`,
							},
						],
					},
				],
				pinned: false,
				type: 0,
			},
			user: testUser,
			app_permissions: "0",
			entitlements: [],
		} as unknown as APIMessageComponentInteraction;

		const response = await handleDiscordInteraction(
			{ runAction: vi.fn(), runQuery: vi.fn(), runMutation } as never,
			interaction,
		);

		expect(runMutation).toHaveBeenCalledOnce();
		expect(runMutation.mock.calls[0]?.[1]).toEqual({
			token: "token-123",
			discordUserId: testUser.id,
		});

		const body = await response.json();
		expect(body.type).toBe(7);
		expect(body.data.content).toBe("Task moved to done.");
		expect(body.data.components).toEqual([]);
	});
});
