import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Competition } from "@/data/types-new";
import { pickDefined } from "@/lib/utils";

export const useCompetitions = () => {
	const d = useQuery(api.competitions.listForUI);
	return { competitions: d ?? [], isLoading: d === undefined };
};

export const useCompetition = (competitionId: Id<"competitions"> | null) => {
	const data = useQuery(
		api.competitions.getForUI,
		competitionId ? { competitionId } : "skip",
	);
	if (competitionId == null) return null;
	return data;
};

export function useCompetitionMutations() {
	const createCompetition = useMutation(api.competitions.create);
	const updateCompetitionMutation = useMutation(api.competitions.update);
	const removeCompetitionMutation = useMutation(api.competitions.remove);

	return {
		addCompetition: async (
			payload: Omit<
				Competition,
				"id" | "tasks" | "progressUpdates" | "createdAt" | "updatedAt"
			>,
		) => {
			const id = await createCompetition({
				name: payload.name,
				description: payload.description,
				compStart: payload.compStart,
				compEnd: payload.compEnd,
				compLeadId: payload.compLead?.id ?? undefined,
				leadDelegateId: payload.leadDelegate?.id ?? undefined,
				organiserIds: payload.organisers.map((u) => u.id),
				compSheet: payload.compSheet ?? undefined,
			});
			return {
				...payload,
				id,
				tasks: [],
				progressUpdates: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			} satisfies Competition;
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
				>
			> & { currentPhaseId?: Id<"phases"> | null },
		) =>
			updateCompetitionMutation({
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
							? updates.organisers.map((u) => u.id)
							: undefined,
					currentPhaseId:
						updates.currentPhaseId !== undefined
							? (updates.currentPhaseId ?? undefined)
							: undefined,
					compSheet:
						updates.compSheet !== undefined
							? (updates.compSheet ?? null)
							: undefined,
				}),
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
