import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRetainedQueryResult } from "./use-retained-query-result";

export const useDiscordSettings = () => {
	const result = useQuery(api.discord.api.getCurrentUserSettings, {});
	const { data, isLoading, isRefreshing } = useRetainedQueryResult(result);
	return {
		settings: data,
		link: data?.link ?? null,
		dmEnabled: data?.dmEnabled ?? true,
		preferences: data?.preferences ?? [],
		isLoading,
		isRefreshing,
	};
};

export const useDiscordAdminLinks = () => {
	const result = useQuery(api.discord.api.listLinkedUsers, {});
	const { data, isLoading, isRefreshing } = useRetainedQueryResult(result);
	return {
		users: data ?? [],
		isLoading,
		isRefreshing,
	};
};

export function useDiscordMutations() {
	const setCurrentUserDmEnabled = useMutation(
		api.discord.api.setCurrentUserDmEnabled,
	);
	const setCurrentUserTypePreference = useMutation(
		api.discord.api.setCurrentUserTypePreference,
	);
	const setUserLink = useMutation(api.discord.api.setUserLink);
	const clearUserLink = useMutation(api.discord.api.clearUserLink);

	return {
		setCurrentUserDmEnabled: (dmEnabled: boolean) =>
			setCurrentUserDmEnabled({ dmEnabled }),
		setCurrentUserTypePreference: (
			type: Parameters<typeof setCurrentUserTypePreference>[0]["type"],
			enabled: boolean,
		) => setCurrentUserTypePreference({ type, enabled }),
		setUserLink: (payload: {
			userId: Id<"users">;
			discordUserId: string;
			discordUsername: string;
			discordDisplayName?: string;
			discordAvatarUrl?: string;
		}) => setUserLink(payload),
		clearUserLink: (userId: Id<"users">) => clearUserLink({ userId }),
	};
}

export function useDiscordActions() {
	const listGuildChannels = useAction(api.discord.api.listGuildChannels);
	const listGuildMembers = useAction(api.discord.api.listGuildMembers);
	const registerSlashCommands = useAction(
		api.discord.api.registerSlashCommands,
	);
	return {
		listGuildChannels: () => listGuildChannels({}),
		listGuildMembers: () => listGuildMembers({}),
		registerSlashCommands: () => registerSlashCommands({}),
	};
}
