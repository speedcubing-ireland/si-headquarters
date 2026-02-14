import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { CanvaPickerDialog } from "@/components/admin/linked-actions/canva-picker-dialog";
import {
	CanvaPickerList,
	type CanvaPickerListRow,
} from "@/components/admin/linked-actions/canva-picker-list";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCanvaFolderPicker } from "@/hooks/convex/use-canva-pickers";

type FolderPathNode = {
	id: string;
	name: string;
};

export type SelectedCanvaFolder = {
	id: string;
	name: string;
	path: string;
};

const ROOT_NODE: FolderPathNode = {
	id: "root",
	name: "Root",
};

const SHARED_NODE: FolderPathNode = {
	id: "root",
	name: "Shared",
};

type FolderRootMode = "root" | "shared";

interface CanvaFolderPickerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (folder: SelectedCanvaFolder) => void;
}

export function CanvaFolderPickerDialog({
	open,
	onOpenChange,
	onSelect,
}: CanvaFolderPickerDialogProps) {
	const [search, setSearch] = useState("");
	const [rootMode, setRootMode] = useState<FolderRootMode>("shared");
	const [path, setPath] = useState<FolderPathNode[]>([SHARED_NODE]);
	const current = path[path.length - 1] ?? ROOT_NODE;
	const { items, isLoading, isLoadingMore, error, hasMore, loadMore } =
		useCanvaFolderPicker(current.id, search);

	useEffect(() => {
		if (open) return;
		setSearch("");
		setRootMode("shared");
		setPath([SHARED_NODE]);
	}, [open]);

	const pathLabel = useMemo(
		() => path.map((node) => node.name).join(" / "),
		[path],
	);
	const rows = useMemo<CanvaPickerListRow[]>(
		() =>
			items.map((item) => ({
				id: item.id,
				title: item.name,
				meta: item.id,
			})),
		[items],
	);

	const selectFolder = (folder: FolderPathNode) => {
		const basePath = path.map((node) => node.name).join(" / ");
		onSelect({
			id: folder.id,
			name: folder.name,
			path:
				folder.id === "root" ? ROOT_NODE.name : `${basePath} / ${folder.name}`,
		});
		onOpenChange(false);
	};

	return (
		<CanvaPickerDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Select Canva Destination Folder"
			description="Browse Canva folders and choose where generated designs should be moved."
			searchPlaceholder="Filter current folder"
			searchValue={search}
			onSearchChange={setSearch}
		>
			<div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
				<div className="flex min-w-0 items-center gap-2">
					<Select
						value={rootMode}
						onValueChange={(value) => {
							const mode = value as FolderRootMode;
							setRootMode(mode);
							setPath([mode === "root" ? ROOT_NODE : SHARED_NODE]);
							setSearch("");
						}}
					>
						<SelectTrigger className="h-7 w-[170px] text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="root">My Projects</SelectItem>
							<SelectItem value="shared">Shared / Team</SelectItem>
						</SelectContent>
					</Select>
					<span className="truncate text-muted-foreground">
						Current: {pathLabel}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={path.length <= 1}
						onClick={() => {
							setPath((previous) => previous.slice(0, -1));
							setSearch("");
						}}
					>
						Back
					</Button>
					{rootMode === "root" ? (
						<Button size="sm" onClick={() => selectFolder(ROOT_NODE)}>
							Use Root
						</Button>
					) : null}
				</div>
			</div>
			<CanvaPickerList
				rows={rows}
				isLoading={isLoading}
				isLoadingMore={isLoadingMore}
				error={error}
				hasMore={hasMore}
				emptyLabel="No folders found."
				onLoadMore={loadMore}
				onSelect={(row) => {
					selectFolder({ id: row.id, name: row.title });
				}}
				selectLabel="Use folder"
				renderActions={(row) => (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setPath((previous) => [
								...previous,
								{ id: row.id, name: row.title },
							]);
							setSearch("");
						}}
					>
						Open
						<ChevronRight className="size-3.5" />
					</Button>
				)}
			/>
		</CanvaPickerDialog>
	);
}
