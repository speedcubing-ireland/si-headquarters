import { useAction, useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type {
	CanvaTemplateActionConfig,
	LinkedActionRunPermission,
	LinkedSheetActionConfig,
} from "@/data/types-new";
import {
	type SelectedCanvaTemplate,
	CanvaTemplatePickerDialog,
} from "@/components/admin/linked-actions/canva-template-picker-dialog";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { onMutationError } from "@/lib/utils";

type ActionType = "canva_template" | "linked_sheet";
type LinkedSheetOperation = LinkedSheetActionConfig["operation"];
type RunPermission = LinkedActionRunPermission;
type SelectedCanvaFolder = {
	id: string;
	name: string;
	path: string;
};

const DEFAULT_RUN_PERMISSION_BY_TYPE: Record<ActionType, RunPermission> = {
	canva_template: "volunteer",
	linked_sheet: "anyone",
};

const DEFAULT_CANVA_CONFIG: CanvaTemplateActionConfig = {
	sourceBrandTemplateId: "",
	destinationFolderId: "root",
	naming: {
		mode: "parent_plus_suffix",
		defaultSuffix: "",
	},
};

const DEFAULT_SHEET_CONFIG: LinkedSheetActionConfig = {
	operation: "transfer_schedule_to_wca",
};

const ROOT_FOLDER: SelectedCanvaFolder = {
	id: "root",
	name: "Root",
	path: "Root",
};

export function canCreateLinkedActionDraft(args: {
	type: ActionType;
	name: string;
	shortId: string;
	canvaConfig: CanvaTemplateActionConfig;
}): boolean {
	if (!args.name.trim() || !args.shortId.trim()) return false;
	if (args.type === "linked_sheet") return true;
	return (
		args.canvaConfig.sourceBrandTemplateId.trim().length > 0 &&
		args.canvaConfig.destinationFolderId.trim().length > 0
	);
}

export function LinkedActionsSection() {
	const definitions = useQuery(api.linkedActions.listDefinitions, {}) ?? [];
	const createDefinition = useMutation(api.linkedActions.createDefinition);
	const updateDefinition = useMutation(api.linkedActions.updateDefinition);
	const [name, setName] = useState("");
	const [shortId, setShortId] = useState("");
	const [type, setType] = useState<ActionType>("linked_sheet");
	const [runPermission, setRunPermission] = useState<RunPermission>(
		DEFAULT_RUN_PERMISSION_BY_TYPE.linked_sheet,
	);
	const [canvaConfig, setCanvaConfig] =
		useState<CanvaTemplateActionConfig>(DEFAULT_CANVA_CONFIG);
	const [sheetConfig, setSheetConfig] =
		useState<LinkedSheetActionConfig>(DEFAULT_SHEET_CONFIG);
	const [selectedTemplate, setSelectedTemplate] =
		useState<SelectedCanvaTemplate | null>(null);
	const [selectedFolder, setSelectedFolder] =
		useState<SelectedCanvaFolder>(ROOT_FOLDER);
	const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
	const [folderInputOpen, setFolderInputOpen] = useState(false);
	const [folderInputValue, setFolderInputValue] = useState("");
	const [isValidatingFolder, setIsValidatingFolder] = useState(false);

	const validateCanvaFolderInput = useAction(api.canva.validateFolderInput);

	const orderedDefinitions = useMemo(
		() =>
			[...definitions].sort((a, b) => {
				if (a.archived !== b.archived) return a.archived ? 1 : -1;
				return a.name.localeCompare(b.name);
			}),
		[definitions],
	);

	const canCreate = canCreateLinkedActionDraft({
		type,
		name,
		shortId,
		canvaConfig,
	});

	const onSelectTemplate = (template: SelectedCanvaTemplate) => {
		setSelectedTemplate(template);
		setCanvaConfig((prev) => ({
			...prev,
			sourceBrandTemplateId: template.id,
		}));
	};

	const onValidateFolder = () => {
		setIsValidatingFolder(true);
		void validateCanvaFolderInput({ value: folderInputValue })
			.then((folder) => {
				setSelectedFolder(folder);
				setCanvaConfig((prev) => ({
					...prev,
					destinationFolderId: folder.id,
				}));
				setFolderInputOpen(false);
				toast.success("Canva folder validated.");
			})
			.catch(onMutationError)
			.finally(() => setIsValidatingFolder(false));
	};

	const onCreate = async () => {
		const trimmedName = name.trim();
		const trimmedShortId = shortId.trim();
		if (
			!canCreateLinkedActionDraft({
				type,
				name: trimmedName,
				shortId: trimmedShortId,
				canvaConfig,
			})
		) {
			if (type === "canva_template") {
				toast.error("Select a Canva template and destination folder.");
			}
			return;
		}

		const config = type === "canva_template" ? canvaConfig : sheetConfig;
		try {
			await createDefinition({
				name: trimmedName,
				shortId: trimmedShortId,
				type,
				runPermission,
				config,
			});
			setName("");
			setShortId("");
			if (type === "canva_template") {
				setCanvaConfig(DEFAULT_CANVA_CONFIG);
				setSelectedTemplate(null);
				setSelectedFolder(ROOT_FOLDER);
			}
			if (type === "linked_sheet") {
				setSheetConfig(DEFAULT_SHEET_CONFIG);
			}
			toast.success("Linked integration created.");
		} catch (error) {
			onMutationError(error);
		}
	};

	return (
		<div className="space-y-4 pb-4">
			<Card>
				<CardHeader>
					<CardTitle>Create Linked Integration</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-3 md:grid-cols-4">
						<div className="space-y-1.5">
							<Label>Name</Label>
							<Input
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="Certificates"
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Short ID</Label>
							<Input
								value={shortId}
								onChange={(event) => setShortId(event.target.value)}
								placeholder="canva.certificates"
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Type</Label>
							<Select
								value={type}
								onValueChange={(value) => {
									const nextType = value as ActionType;
									setType(nextType);
									setRunPermission(DEFAULT_RUN_PERMISSION_BY_TYPE[nextType]);
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="linked_sheet">Linked Sheet</SelectItem>
									<SelectItem value="canva_template">Canva Template</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label>Run permission</Label>
							<Select
								value={runPermission}
								onValueChange={(value) =>
									setRunPermission(value as RunPermission)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{type === "linked_sheet" ? (
										<SelectItem value="anyone">
											Anyone with task access
										</SelectItem>
									) : null}
									<SelectItem value="volunteer">Volunteer</SelectItem>
									<SelectItem value="owner">Task owner</SelectItem>
									<SelectItem value="assignee">Task assignee</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{type === "linked_sheet" ? (
						<div className="space-y-1.5">
							<Label>Operation</Label>
							<Select
								value={sheetConfig.operation}
								onValueChange={(value) =>
									setSheetConfig({
										operation: value as LinkedSheetOperation,
									})
								}
							>
								<SelectTrigger className="max-w-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="transfer_schedule_to_wca">
										Transfer schedule to WCA
									</SelectItem>
									<SelectItem value="populate_checkin_sheet">
										Populate check-in sheet (noop)
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					) : (
						<div className="space-y-3">
							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-1.5">
									<Label>Source Brand Template</Label>
									<div className="rounded-md border p-3">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div className="min-w-0">
												<p className="truncate text-sm font-medium">
													{selectedTemplate?.title ?? "No template selected"}
												</p>
												<p className="truncate text-xs text-muted-foreground">
													{selectedTemplate?.id ?? "Select a brand template"}
												</p>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => setTemplatePickerOpen(true)}
											>
												Select Template
											</Button>
										</div>
									</div>
								</div>
								<div className="space-y-1.5">
									<Label>Destination Folder</Label>
									<div className="rounded-md border p-3">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div className="min-w-0">
												<p className="truncate text-sm font-medium">
													{selectedFolder.path}
												</p>
												<p className="truncate text-xs text-muted-foreground">
													{selectedFolder.id}
												</p>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													setFolderInputValue(
														selectedFolder.id === "root"
															? ""
															: selectedFolder.id,
													);
													setFolderInputOpen(true);
												}}
											>
												Set Folder
											</Button>
										</div>
									</div>
								</div>
							</div>

							<div className="space-y-1.5">
								<Label>Default naming suffix</Label>
								<Input
									value={canvaConfig.naming.defaultSuffix}
									onChange={(event) =>
										setCanvaConfig((prev) => ({
											...prev,
											naming: {
												...prev.naming,
												defaultSuffix: event.target.value,
											},
										}))
									}
									placeholder="Certificates"
								/>
								<p className="text-xs text-muted-foreground">
									Canva sharing is confirmed manually after each run from the
									task panel.
								</p>
							</div>
						</div>
					)}

					<div className="flex justify-end">
						<Button disabled={!canCreate} onClick={() => void onCreate()}>
							Create integration
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Integration Bank</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{orderedDefinitions.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No linked integrations configured yet.
						</p>
					) : (
						orderedDefinitions.map((definition) => (
							<div
								key={definition.id}
								className="rounded-md border px-3 py-2 text-sm"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="min-w-0">
										<p className="font-medium truncate">{definition.name}</p>
										<p className="text-xs text-muted-foreground">
											{definition.shortId} · {definition.type}
											{` · run: ${definition.runPermission}`}
											{definition.archived ? " · archived" : ""}
										</p>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											void updateDefinition({
												id: definition.id,
												updates: { archived: !definition.archived },
											}).catch((error) => {
												onMutationError(error);
												toast.error("Failed to update linked integration.");
											});
										}}
									>
										{definition.archived ? "Unarchive" : "Archive"}
									</Button>
								</div>
							</div>
						))
					)}
				</CardContent>
			</Card>

			<CanvaTemplatePickerDialog
				open={templatePickerOpen}
				onOpenChange={setTemplatePickerOpen}
				onSelect={onSelectTemplate}
			/>
			<ResponsiveModal
				open={folderInputOpen}
				onOpenChange={setFolderInputOpen}
				dialogContentClassName="sm:max-w-[520px]"
				sheetContentClassName="p-6"
			>
				<DialogHeader>
					<DialogTitle>Set Canva Destination Folder</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					<Label htmlFor="canva-folder-input">
						Folder ID or Canva folder link
					</Label>
					<Input
						id="canva-folder-input"
						value={folderInputValue}
						onChange={(event) => setFolderInputValue(event.target.value)}
						placeholder="FAF... or https://www.canva.com/folder/FAF..."
					/>
					<p className="text-xs text-muted-foreground">
						Use <code>root</code> to save at top level.
					</p>
					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={() => setFolderInputOpen(false)}
							disabled={isValidatingFolder}
						>
							Cancel
						</Button>
						<Button
							onClick={onValidateFolder}
							disabled={!folderInputValue.trim() || isValidatingFolder}
						>
							{isValidatingFolder ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							Validate & Use
						</Button>
					</div>
				</div>
			</ResponsiveModal>
		</div>
	);
}
