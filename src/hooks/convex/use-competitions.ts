import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Competition } from "@/data/types-new";
import { pickDefined } from "@/lib/utils";
import { useRetainedQueryResult } from "./use-retained-query-result";

type NewCompetitionInput = Pick<
	Competition,
	| "name"
	| "description"
	| "compStart"
	| "compEnd"
	| "compLead"
	| "leadDelegate"
	| "organisers"
	| "compSheet"
	| "wcaCompetitionId"
>;

export const useCompetitions = () => {
	const result = useQuery(api.competitions.listForUI);
	const { data, isLoading, isRefreshing } = useRetainedQueryResult(result);
	return { competitions: data ?? [], isLoading, isRefreshing };
};

export const useCompetition = (competitionId: Id<"competitions"> | null) => {
	const result = useQuery(
		api.competitions.getForUI,
		competitionId ? { competitionId } : "skip",
	);
	const { data } = useRetainedQueryResult(result, competitionId ?? "skip");
	if (competitionId == null) return null;
	return data;
};

export function useCompetitionMutations() {
	const createCompetition = useMutation(api.competitions.create);
	const updateCompetitionAction = useAction(api.competitions.update);
	const removeCompetitionMutation = useMutation(api.competitions.remove);

	return {
		addCompetition: async (payload: NewCompetitionInput) => {
			const id = await createCompetition({
				name: payload.name,
				description: payload.description,
				compStart: payload.compStart,
				compEnd: payload.compEnd,
				compLeadId: payload.compLead?.id ?? undefined,
				leadDelegateId: payload.leadDelegate?.id ?? undefined,
				organiserIds: payload.organisers.map((u: Competition["organisers"][number]) => u.id),
				compSheet: payload.compSheet ?? undefined,
				wcaCompetitionId: payload.wcaCompetitionId ?? undefined,
			});
			return { id };
		},

		updateCompetition: (
			id: Id<"competitions">,
			updates: Partial<
				Pick<
					Competition,
					| "name"
					| "description"
					| "compStart"
					| "compEnd"
					| "compLead"
					| "leadDelegate"
					| "organisers"
					| "compSheet"
					| "wcaCompetitionId"
				>
			> & {
				currentPhaseId?: Id<"phases"> | null;
				sponsorPropertyStatusOverride?:
					| Competition["sponsorPropertyStatus"]
					| null;
				sponsorOverrideSponsorId?: Id<"sponsors"> | null;
			},
		) =>
			updateCompetitionAction({
				competitionId: id,
				updates: pickDefined({
					name: updates.name,
					description: updates.description,
					compStart: updates.compStart,
					compEnd: updates.compEnd,
					compLeadId:
						updates.compLead !== undefined
							? (updates.compLead?.id ?? null)
							: undefined,
					leadDelegateId:
						updates.leadDelegate !== undefined
							? (updates.leadDelegate?.id ?? null)
							: undefined,
					organiserIds:
						updates.organisers !== undefined
							? updates.organisers.map((u: Competition["organisers"][number]) => u.id)
							: undefined,
					currentPhaseId:
						updates.currentPhaseId !== undefined
							? (updates.currentPhaseId ?? undefined)
							: undefined,
					compSheet:
						updates.compSheet !== undefined
							? (updates.compSheet ?? null)
							: undefined,
					wcaCompetitionId:
						updates.wcaCompetitionId !== undefined
							? (updates.wcaCompetitionId ?? null)
							: undefined,
					manualSponsorPropertyStatus:
						updates.sponsorPropertyStatusOverride !== undefined
							? updates.sponsorPropertyStatusOverride
							: undefined,
					manualSponsorId:
						updates.sponsorOverrideSponsorId !== undefined
							? updates.sponsorOverrideSponsorId
							: undefined,
				}),
			}).then((error) => {
				if (error) throw new Error(error);
			}),

		deleteCompetition: (id: Id<"competitions">) =>
			removeCompetitionMutation({ competitionId: id }),
	};
}

export function useCompetitionUpdateMutations() {
	const createUpdateMutation = useMutation(api.updates.create);
	const addReactionMutation = useMutation(api.updates.addReaction);
	return {
		createUpdate: (
			competitionId: Id<"competitions">,
			payload: {
				status: "on-track" | "at-risk" | "off-track";
				message?: string;
			},
		) =>
			createUpdateMutation({
				competitionId,
				status: payload.status,
				message: payload.message,
			}),
		addReaction: (updateId: Id<"competitionUpdates">, emoji: string) =>
			addReactionMutation({ updateId, emoji }),
	};
}
