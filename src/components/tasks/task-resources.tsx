"use client";

import { useState } from "react";
import {
	ExternalLink,
	FileSpreadsheet,
	Link2,
	Palette,
	Plus,
	Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useDataV2 } from "@/data/data-store-v2";
import type { LinkedResource, Task } from "@/data/types-new";

interface TaskResourcesSectionProps {
	task: Task;
}

// Detect resource type from URL
function detectResourceType(url: string): LinkedResource["type"] | "url" {
	if (url.includes("canva.com")) return "canva-design";
	if (
		url.includes("docs.google.com/spreadsheets") ||
		url.includes("sheets.google.com")
	)
		return "google-sheet";
	return "url";
}

function ResourceCard({
	resource,
	onRemove,
}: {
	resource: LinkedResource;
	onRemove: () => void;
}) {
	const getResourceIcon = () => {
		switch (resource.type) {
			case "canva-design":
				return <Palette className="size-4 text-pink-500" />;
			case "google-sheet":
				return <FileSpreadsheet className="size-4 text-green-500" />;
			default:
				return <Link2 className="size-4 text-blue-500" />;
		}
	};

	const getResourceLabel = () => {
		switch (resource.type) {
			case "canva-design":
				return "Canva";
			case "google-sheet":
				return "Google Sheet";
			default:
				return "Link";
		}
	};

	const handleOpen = () => {
		let url = "";
		switch (resource.type) {
			case "canva-design":
				url = `https://www.canva.com/design/${resource.designId}`;
				break;
			case "google-sheet":
				url = `https://docs.google.com/spreadsheets/d/${resource.sheetId}`;
				break;
		}
		if (url) window.open(url, "_blank");
	};

	return (
		<div className="border rounded-lg overflow-hidden bg-card">
			<div className="flex items-center gap-2 p-2 border-b">
				{getResourceIcon()}
				<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{getResourceLabel()}
				</span>
				<div className="ml-auto flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={handleOpen}
						title="Open in new tab"
					>
						<ExternalLink className="size-3" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={onRemove}
						title="Remove resource"
					>
						<Trash2 className="size-3 text-muted-foreground" />
					</Button>
				</div>
			</div>

			{/* Preview / Embed */}
			<div className="relative">
				{resource.type === "canva-design" && (
					<div className="aspect-video bg-muted flex items-center justify-center">
						<div className="text-center p-4">
							<Palette className="size-8 mx-auto mb-2 text-pink-500/50" />
							<p className="text-sm text-muted-foreground">Canva Design</p>
							<Button
								variant="outline"
								size="sm"
								className="mt-2"
								onClick={handleOpen}
							>
								<ExternalLink className="size-3 mr-1" />
								Open in Canva
							</Button>
						</div>
					</div>
				)}

				{resource.type === "google-sheet" && (
					<div className="aspect-[4/3] bg-muted flex items-center justify-center">
						<div className="text-center p-4">
							<FileSpreadsheet className="size-8 mx-auto mb-2 text-green-500/50" />
							<p className="text-sm text-muted-foreground">Google Sheet</p>
							<Button
								variant="outline"
								size="sm"
								className="mt-2"
								onClick={handleOpen}
							>
								<ExternalLink className="size-3 mr-1" />
								Open Sheet
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function AddResourceDialog({
	open,
	onOpenChange,
	task,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	task: Task;
}) {
	const [url, setUrl] = useState("");
	const [resourceType, setResourceType] = useState<
		LinkedResource["type"] | "auto"
	>("auto");
	const updateTask = useDataV2((state) => state.updateTask);

	const handleAdd = () => {
		if (!url.trim()) return;

		const detected = detectResourceType(url);
		const finalType = resourceType === "auto" ? detected : resourceType;

		let resource: LinkedResource;

		switch (finalType) {
			case "canva-design": {
				// Extract design ID from Canva URL
				const match = url.match(/\/design\/([A-Za-z0-9]+)/);
				const designId = match ? match[1] : url.split("/").pop() || "";
				resource = { type: "canva-design", designId };
				break;
			}
			case "google-sheet": {
				// Extract sheet ID from Google Sheets URL
				const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
				const sheetId = match ? match[1] : url.split("/").pop() || "";
				resource = { type: "google-sheet", sheetId };
				break;
			}
			default:
				// Fallback to generic link stored as canva-design with the URL as ID
				resource = { type: "canva-design", designId: url };
		}

		updateTask(task.id, {
			resources: [...task.resources, resource],
		});

		setUrl("");
		setResourceType("auto");
		onOpenChange(false);
	};

	const detectedType = detectResourceType(url);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[450px]">
				<DialogHeader>
					<DialogTitle>Attach Resource</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="resource-url" className="text-sm font-medium">
							Resource URL
						</Label>
						<Input
							id="resource-url"
							placeholder="https://..."
							value={url}
							onChange={(e) => setUrl(e.target.value)}
						/>
						{url && detectedType !== "url" && (
							<p className="text-xs text-muted-foreground">
								Detected:{" "}
								{detectedType === "canva-design"
									? "Canva Design"
									: "Google Sheet"}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="resource-type" className="text-sm font-medium">
							Resource Type
						</Label>
						<Select
							value={resourceType}
							onValueChange={(v) =>
								setResourceType(v as LinkedResource["type"] | "auto")
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="auto">Auto-detect</SelectItem>
								<SelectItem value="canva-design">Canva Design</SelectItem>
								<SelectItem value="google-sheet">Google Sheet</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex justify-end gap-2 pt-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button onClick={handleAdd} disabled={!url.trim()}>
							Add Resource
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function TaskResourcesSection({ task }: TaskResourcesSectionProps) {
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const updateTask = useDataV2((state) => state.updateTask);

	const handleRemoveResource = (index: number) => {
		const newResources = [...task.resources];
		newResources.splice(index, 1);
		updateTask(task.id, { resources: newResources });
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-medium flex items-center gap-1.5">
					<Link2 className="size-4" />
					Resources ({task.resources.length})
				</h3>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setAddDialogOpen(true)}
				>
					<Plus className="size-3.5 mr-1" />
					Add
				</Button>
			</div>

			{task.resources.length === 0 ? (
				<div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
					No resources attached
				</div>
			) : (
				<div className="grid gap-3">
					{task.resources.map((resource, index) => (
						<ResourceCard
							key={`${resource.type}-${resource.type === "canva-design" ? resource.designId : resource.sheetId}`}
							resource={resource}
							onRemove={() => handleRemoveResource(index)}
						/>
					))}
				</div>
			)}

			<AddResourceDialog
				open={addDialogOpen}
				onOpenChange={setAddDialogOpen}
				task={task}
			/>
		</div>
	);
}
