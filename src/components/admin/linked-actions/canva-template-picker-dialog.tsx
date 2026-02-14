import { useEffect, useMemo, useState } from "react";
import { CanvaPickerDialog } from "@/components/admin/linked-actions/canva-picker-dialog";
import {
	CanvaPickerList,
	type CanvaPickerListRow,
} from "@/components/admin/linked-actions/canva-picker-list";
import { useCanvaTemplatePicker } from "@/hooks/convex/use-canva-pickers";

export type SelectedCanvaTemplate = {
	id: string;
	title: string;
	url: string | null;
};

interface CanvaTemplatePickerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (template: SelectedCanvaTemplate) => void;
}

export function CanvaTemplatePickerDialog({
	open,
	onOpenChange,
	onSelect,
}: CanvaTemplatePickerDialogProps) {
	const [search, setSearch] = useState("");
	const { items, isLoading, isLoadingMore, error, hasMore, loadMore } =
		useCanvaTemplatePicker(search);

	useEffect(() => {
		if (open) return;
		setSearch("");
	}, [open]);

	const rows = useMemo<CanvaPickerListRow[]>(
		() =>
			items.map((item) => ({
				id: item.id,
				title: item.title,
				subtitle: item.url ?? undefined,
				meta: item.id,
			})),
		[items],
	);

	return (
		<CanvaPickerDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Select Canva Brand Template"
			description="Choose the Canva brand template used when this linked integration runs."
			searchPlaceholder="Search templates by name"
			searchValue={search}
			onSearchChange={setSearch}
		>
			<CanvaPickerList
				rows={rows}
				isLoading={isLoading}
				isLoadingMore={isLoadingMore}
				error={error}
				hasMore={hasMore}
				emptyLabel="No templates found."
				onLoadMore={loadMore}
				onSelect={(row) => {
					const selected = items.find((item) => item.id === row.id);
					if (!selected) return;
					onSelect(selected);
					onOpenChange(false);
				}}
				selectLabel="Use template"
			/>
		</CanvaPickerDialog>
	);
}
