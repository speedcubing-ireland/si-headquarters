import { createFileRoute } from "@tanstack/react-router";
import { Plus, Settings, Tag, Trash2, Edit2, Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDataV2 } from "@/data/data-store-v2";
import type { TaskLabel } from "@/data/types-new";

const PRESET_COLORS = [
	"#ef4444", // red
	"#f97316", // orange
	"#eab308", // yellow
	"#22c55e", // green
	"#06b6d4", // cyan
	"#3b82f6", // blue
	"#8b5cf6", // purple
	"#ec4899", // pink
	"#6b7280", // gray
];

function LabelRow({
	label,
	onEdit,
	onDelete,
}: {
	label: TaskLabel;
	onEdit: (id: string, updates: Partial<TaskLabel>) => void;
	onDelete: (id: string) => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editedName, setEditedName] = useState(label.name);
	const [editedColor, setEditedColor] = useState(label.color);

	const handleSave = () => {
		if (editedName.trim() && editedName !== label.name) {
			onEdit(label.id, { name: editedName.trim(), color: editedColor });
		} else if (editedColor !== label.color) {
			onEdit(label.id, { color: editedColor });
		}
		setIsEditing(false);
	};

	const handleCancel = () => {
		setEditedName(label.name);
		setEditedColor(label.color);
		setIsEditing(false);
	};

	if (isEditing) {
		return (
			<div className="flex items-center gap-3 py-3 px-4 border-b last:border-0 bg-muted/30">
				<div className="flex gap-1">
					{PRESET_COLORS.map((color) => (
						<button
							key={color}
							type="button"
							onClick={() => setEditedColor(color)}
							className={`w-6 h-6 rounded-full border-2 transition-all ${
								editedColor === color
									? "border-foreground scale-110"
									: "border-transparent hover:scale-105"
							}`}
							style={{ backgroundColor: color }}
						/>
					))}
				</div>
				<Input
					value={editedName}
					onChange={(e) => setEditedName(e.target.value)}
					className="flex-1 h-8"
					autoFocus
				/>
				<div className="flex gap-1">
					<Button
						size="icon"
						variant="ghost"
						className="size-8"
						onClick={handleSave}
					>
						<Check className="size-4" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="size-8"
						onClick={handleCancel}
					>
						<X className="size-4" />
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center justify-between py-3 px-4 border-b last:border-0 hover:bg-muted/30 transition-colors">
			<div className="flex items-center gap-3">
				<span
					className="w-4 h-4 rounded-full"
					style={{ backgroundColor: label.color }}
				/>
				<span className="font-medium">{label.name}</span>
				<span className="text-xs text-muted-foreground">{label.color}</span>
			</div>
			<div className="flex gap-1">
				<Button
					size="icon"
					variant="ghost"
					className="size-8"
					onClick={() => setIsEditing(true)}
				>
					<Edit2 className="size-4" />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					className="size-8 text-destructive hover:text-destructive"
					onClick={() => onDelete(label.id)}
				>
					<Trash2 className="size-4" />
				</Button>
			</div>
		</div>
	);
}

function RouteComponent() {
	const labels = useDataV2((state) => state.labels);
	const createLabel = useDataV2((state) => state.createLabel);
	const updateLabel = useDataV2((state) => state.updateLabel);
	const deleteLabel = useDataV2((state) => state.deleteLabel);

	const [newLabelName, setNewLabelName] = useState("");
	const [newLabelColor, setNewLabelColor] = useState(PRESET_COLORS[0]);
	const [isCreating, setIsCreating] = useState(false);

	const handleCreate = () => {
		if (newLabelName.trim()) {
			createLabel(newLabelName.trim(), newLabelColor);
			setNewLabelName("");
			setNewLabelColor(PRESET_COLORS[0]);
			setIsCreating(false);
		}
	};

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b">
				<div className="flex items-center gap-2 px-4 lg:px-6">
					<Settings className="size-4 text-muted-foreground" />
					<h1 className="text-sm font-semibold">Settings</h1>
					<span className="text-muted-foreground">/</span>
					<Tag className="size-4 text-muted-foreground" />
					<h1 className="text-sm font-semibold">Labels</h1>
				</div>
			</header>

			<div className="flex-1 px-4 lg:px-6 max-w-3xl">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle className="text-base">Manage Labels</CardTitle>
						<Button
							size="sm"
							onClick={() => setIsCreating(true)}
							disabled={isCreating}
						>
							<Plus className="size-4 mr-1" />
							Add Label
						</Button>
					</CardHeader>
					<CardContent className="p-0">
						{isCreating && (
							<div className="flex items-center gap-3 py-3 px-4 border-b bg-muted/50">
								<div className="flex gap-1">
									{PRESET_COLORS.map((color) => (
										<button
											key={color}
											type="button"
											onClick={() => setNewLabelColor(color)}
											className={`w-6 h-6 rounded-full border-2 transition-all ${
												newLabelColor === color
													? "border-foreground scale-110"
													: "border-transparent hover:scale-105"
											}`}
											style={{ backgroundColor: color }}
										/>
									))}
								</div>
								<Input
									placeholder="Label name"
									value={newLabelName}
									onChange={(e) => setNewLabelName(e.target.value)}
									className="flex-1 h-8"
									autoFocus
									onKeyDown={(e) => {
										if (e.key === "Enter") handleCreate();
										if (e.key === "Escape") setIsCreating(false);
									}}
								/>
								<div className="flex gap-1">
									<Button
										size="icon"
										variant="ghost"
										className="size-8"
										onClick={handleCreate}
									>
										<Check className="size-4" />
									</Button>
									<Button
										size="icon"
										variant="ghost"
										className="size-8"
										onClick={() => {
											setIsCreating(false);
											setNewLabelName("");
										}}
									>
										<X className="size-4" />
									</Button>
								</div>
							</div>
						)}

						{labels.length === 0 ? (
							<div className="py-8 text-center text-sm text-muted-foreground">
								No labels yet. Click "Add Label" to create your first label.
							</div>
						) : (
							labels.map((label) => (
								<LabelRow
									key={label.id}
									label={label}
									onEdit={updateLabel}
									onDelete={deleteLabel}
								/>
							))
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/settings/labels")({
	component: RouteComponent,
});
