import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLabelMutations } from "@/hooks/use-convex-data";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";

function useAdminLabels() {
	const data = useQuery(api.admin.listLabelsWithUsage, {});
	const labels =
		data?.map((l) => ({
			id: l.id as Id<"labels">,
			name: l.name,
			color: l.color,
			archived: l.archived,
			usageCount: l.usageCount,
		})) ?? [];
	return {
		labels,
		isLoading: data === undefined,
	};
}

export function LabelsSection() {
	const { labels, isLoading } = useAdminLabels();
	const {
		createLabel,
		updateLabelAdmin,
		archiveLabel,
		unarchiveLabel,
		deleteLabelIfUnused,
	} = useLabelMutations();

	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState("#3b82f6");
	const [savingId, setSavingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleCreate = async () => {
		if (!newName.trim()) return;
		setError(null);
		try {
			await createLabel(newName.trim(), newColor);
			setNewName("");
		} catch (e) {
			setError((e as Error).message);
		}
	};

	const handleUpdate = async (
		id: Id<"labels">,
		updates: { name?: string; color?: string },
	) => {
		setSavingId(id);
		setError(null);
		try {
			await updateLabelAdmin(id, updates);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setSavingId(null);
		}
	};

	const handleArchiveToggle = async (id: Id<"labels">, archived: boolean) => {
		setSavingId(id);
		setError(null);
		try {
			if (archived) {
				await unarchiveLabel(id);
			} else {
				await archiveLabel(id);
			}
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setSavingId(null);
		}
	};

	const handleDelete = async (id: Id<"labels">) => {
		setSavingId(id);
		setError(null);
		try {
			await deleteLabelIfUnused(id);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setSavingId(null);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<span>Labels</span>
					<span className="text-xs text-muted-foreground">
						Edit, archive &amp; safely delete
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex items-center gap-2">
					<Input
						placeholder="New label name"
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						className="h-8"
					/>
					<Input
						type="color"
						value={newColor}
						onChange={(e) => setNewColor(e.target.value)}
						className="h-8 w-16 p-1"
					/>
					<Button size="sm" onClick={() => void handleCreate()}>
						Add
					</Button>
				</div>

				{error && (
					<div className="text-xs text-destructive wrap-break-word">
						{error}
					</div>
				)}

				{isLoading ? (
					<div className="py-6 flex items-center justify-center">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				) : labels.length === 0 ? (
					<div className="py-4 text-sm text-muted-foreground">
						No labels yet. Create one above.
					</div>
				) : (
					<div className="space-y-2 max-h-64 overflow-y-auto pr-1">
						{labels.map((label) => (
							<div
								key={label.id}
								className="flex items-center justify-between rounded border px-2 py-1 text-xs"
							>
								<div className="flex items-center gap-2">
									<span
										className="h-3 w-3 rounded-full border"
										style={{ backgroundColor: label.color }}
									/>
									<Input
										defaultValue={label.name}
										className="h-7 w-28"
										onBlur={(e) =>
											e.target.value !== label.name &&
											void handleUpdate(label.id, {
												name: e.target.value.trim() || label.name,
											})
										}
									/>
									<Input
										type="color"
										defaultValue={label.color}
										className="h-7 w-12 p-0"
										onBlur={(e) =>
											e.target.value !== label.color &&
											void handleUpdate(label.id, { color: e.target.value })
										}
									/>
									{label.archived && (
										<Badge variant="outline" className="text-[10px]">
											Archived
										</Badge>
									)}
									{label.usageCount > 0 && (
										<span className="text-[10px] text-muted-foreground">
											{label.usageCount} in use
										</span>
									)}
								</div>
								<div className="flex items-center gap-1">
									<Button
										size="sm"
										variant="outline"
										className="h-7 px-2 text-[11px]"
										onClick={() =>
											void handleArchiveToggle(label.id, label.archived)
										}
										disabled={savingId === label.id}
									>
										{label.archived ? "Unarchive" : "Archive"}
									</Button>
									<Button
										size="sm"
										variant="outline"
										className="h-7 px-2 text-[11px] text-destructive border-destructive"
										onClick={() => void handleDelete(label.id)}
										disabled={savingId === label.id || label.usageCount > 0}
										title={
											label.usageCount > 0
												? "Cannot delete a label that is still used by tasks"
												: "Delete label"
										}
									>
										Delete
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
