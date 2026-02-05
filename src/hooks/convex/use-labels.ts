import { useQuery, useMutation } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { TaskLabel } from "@/data/types-new";

export function useLabels(): { labels: TaskLabel[]; isLoading: boolean } {
	const data = useQuery(api.labels.list);
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
		isLoading: data === undefined,
	};
}

export function useLabelMutations() {
	const createLabelMutation = useMutation(api.labels.create);
	const updateLabelMutation = useMutation(api.labels.update);
	const removeLabelMutation = useMutation(api.labels.remove);
	const adminUpdateLabelMutation = useMutation(api.admin.updateLabelAdmin);
	const archiveLabelMutation = useMutation(api.admin.archiveLabel);
	const unarchiveLabelMutation = useMutation(api.admin.unarchiveLabel);
	const deleteLabelIfUnusedMutation = useMutation(
		api.admin.deleteLabelIfUnused,
	);

	return {
		createLabel: async (name: string, color: string) => {
			const id = await createLabelMutation({ name, color });
			return { id, name, color } as TaskLabel;
		},
		updateLabel: async (
			id: string,
			updates: Partial<Pick<TaskLabel, "name" | "color">>,
		) => {
			await updateLabelMutation({ id: id as Id<"labels">, ...updates });
		},
		deleteLabel: async (id: string) => {
			await removeLabelMutation({ id: id as Id<"labels"> });
		},
		updateLabelAdmin: async (
			id: Id<"labels">,
			updates: Partial<{ name: string; color: string; archived: boolean }>,
		) => {
			await adminUpdateLabelMutation({ id, ...updates });
		},
		archiveLabel: async (id: Id<"labels">) => {
			await archiveLabelMutation({ id });
		},
		unarchiveLabel: async (id: Id<"labels">) => {
			await unarchiveLabelMutation({ id });
		},
		deleteLabelIfUnused: async (id: Id<"labels">) => {
			await deleteLabelIfUnusedMutation({ id });
		},
	};
}
