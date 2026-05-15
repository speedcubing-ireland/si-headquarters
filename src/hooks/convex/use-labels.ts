import { useQuery, useMutation } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { TaskLabel } from "@/data/types-new";
import { useRetainedQueryResult } from "./use-retained-query-result";

export function useLabels(): { labels: TaskLabel[]; isLoading: boolean } {
	const result = useQuery(api.core.labels.list);
	const { data, isLoading } = useRetainedQueryResult(result);
	const labels = useMemo(
		() =>
			(data ?? []).map((l) => ({
				id: l._id,
				name: l.name,
				color: l.color,
			})),
		[data],
	);
	return {
		labels,
		isLoading,
	};
}

export function useLabelMutations() {
	const createLabelMutation = useMutation(api.core.labels.create);
	const updateLabelMutation = useMutation(api.core.labels.update);
	const removeLabelMutation = useMutation(api.core.labels.remove);
	const adminUpdateLabelMutation = useMutation(api.core.admin.updateLabelAdmin);
	const deleteLabelIfUnusedMutation = useMutation(
		api.core.admin.deleteLabelIfUnused,
	);

	return {
		createLabel: async (name: string, color: string) => {
			const id = await createLabelMutation({ name, color });
			return { id, name, color } satisfies TaskLabel;
		},
		updateLabel: async (
			id: Id<"labels">,
			updates: Partial<Pick<TaskLabel, "name" | "color">>,
		) => {
			await updateLabelMutation({ id, ...updates });
		},
		deleteLabel: async (id: Id<"labels">) => {
			await removeLabelMutation({ id });
		},
		updateLabelAdmin: async (
			id: Id<"labels">,
			updates: Partial<{ name: string; color: string; archived: boolean }>,
		) => {
			await adminUpdateLabelMutation({ id, ...updates });
		},
		archiveLabel: async (id: Id<"labels">) => {
			await adminUpdateLabelMutation({ id, archived: true });
		},
		unarchiveLabel: async (id: Id<"labels">) => {
			await adminUpdateLabelMutation({ id, archived: false });
		},
		deleteLabelIfUnused: async (id: Id<"labels">) => {
			await deleteLabelIfUnusedMutation({ id });
		},
	};
}
