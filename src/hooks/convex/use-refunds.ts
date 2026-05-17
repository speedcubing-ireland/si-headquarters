import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRetainedQueryResult } from "./use-retained-query-result";

export function useRefundVolunteers(enabled = true) {
	const result = useQuery(
		api.refunds.api.listVolunteers,
		enabled ? {} : "skip",
	);
	const {
		data: volunteers,
		isLoading,
		isRefreshing,
	} = useRetainedQueryResult(
		enabled ? result : undefined,
		enabled ? "on" : "off",
	);
	return {
		volunteers: volunteers ?? [],
		isLoading: enabled && isLoading,
		isRefreshing: enabled && isRefreshing,
	};
}

export function useRefundMutations() {
	const createVolunteerMut = useMutation(api.refunds.api.createVolunteer);
	const updateVolunteerMut = useMutation(api.refunds.api.updateVolunteer);
	const deleteVolunteerMut = useMutation(api.refunds.api.deleteVolunteer);
	const computeRefundsAction = useAction(api.refunds.api.computeRefunds);

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
