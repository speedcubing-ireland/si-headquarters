import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useRefundVolunteers(enabled = true) {
	const volunteers = useQuery(
		api.refunds.listVolunteers,
		enabled ? {} : "skip",
	);
	return {
		volunteers: volunteers ?? [],
		isLoading: enabled && volunteers === undefined,
	};
}

export function useRefundMutations() {
	const createVolunteerMut = useMutation(api.refunds.createVolunteer);
	const updateVolunteerMut = useMutation(api.refunds.updateVolunteer);
	const deleteVolunteerMut = useMutation(api.refunds.deleteVolunteer);
	const computeRefundsAction = useAction(api.refunds.computeRefunds);

	const createVolunteer = useCallback(
		(payload: { name: string; wcaId?: string; transferToWcaIds?: string[] }) =>
			createVolunteerMut(payload),
		[createVolunteerMut],
	);

	const updateVolunteer = useCallback(
		(
			id: Id<"refundVolunteers">,
			updates: {
				name?: string;
				wcaId?: string;
				transferToWcaIds?: string[];
				archived?: boolean;
			},
		) =>
			updateVolunteerMut({
				id,
				...updates,
			}),
		[updateVolunteerMut],
	);

	const deleteVolunteer = useCallback(
		(id: Id<"refundVolunteers">) => deleteVolunteerMut({ id }),
		[deleteVolunteerMut],
	);

	const computeRefunds = useCallback(
		() => computeRefundsAction({}),
		[computeRefundsAction],
	);

	return {
		createVolunteer,
		updateVolunteer,
		deleteVolunteer,
		computeRefunds,
	};
}
