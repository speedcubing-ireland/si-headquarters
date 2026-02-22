import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Link2, Loader2, Palette, Plus, Sheet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type {
	CanvaTemplateActionConfig,
	LinkedSheetActionConfig,
	Task,
	TaskLinkedAction,
} from "@/data/types-new";
import { onMutationError } from "@/lib/utils";
import { CanvaTemplatePane } from "@/components/tasks/linked-actions/pane-canva-template";
import { LinkedSheetPane } from "@/components/tasks/linked-actions/pane-linked-sheet";
import {
	LinkedActionStateNote,
	LinkedActionStatusBadge,
} from "@/components/tasks/linked-actions/linked-action-status";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";

interface TaskLinkedActionsSectionProps {
	task: Task;
	readOnly?: boolean;
}

const ACTION_ICON: Record<
	TaskLinkedAction["definition"]["type"],
	typeof Palette
> = {
	canva_template: Palette,
	linked_sheet: Sheet,
};

function isCanvaConfig(config: unknown): config is CanvaTemplateActionConfig {
	return (
		typeof config === "object" &&
		config !== null &&
		"sourceBrandTemplateId" in config &&
		"destinationFolderId" in config
	);
}

function isLinkedSheetConfig(
	config: unknown,
): config is LinkedSheetActionConfig {
	return typeof config === "object" && config !== null && "operation" in config;
}

function AddLinkedActionDialog({
	open,
	onOpenChange,
	taskId,
	readOnly,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	taskId: Task["id"];
	readOnly: boolean;
}) {
	const definitionsResult = useQuery(
		api.linkedActions.listAvailableDefinitionsForTask,
		{ taskId },
	);
	const linkedActionsResult = useQuery(api.linkedActions.listForTask, {
		taskId,
	});
	const definitionsState = useRetainedQueryResult(definitionsResult, taskId);
	const linkedActionsState = useRetainedQueryResult(
		linkedActionsResult,
		taskId,
	);
	const definitions = definitionsState.data ?? [];
	const linkedActions = linkedActionsState.data ?? [];
	const attachToTask = useMutation(api.linkedActions.attachToTask);
	const [search, setSearch] = useState("");

	const attachedDefinitionIds = useMemo(
		() => new Set(linkedActions.map((item) => item.definition.id)),
		[linkedActions],
	);

	const filtered = useMemo(() => {
		const needle = search.trim().toLowerCase();
		return definitions.filter((definition) => {
			if (attachedDefinitionIds.has(definition.id)) return false;
			if (!needle) return true;
			return (
				definition.name.toLowerCase().includes(needle) ||
				definition.shortId.toLowerCase().includes(needle)
			);
		});
	}, [attachedDefinitionIds, definitions, search]);

	return (
		<ResponsiveModal
			open={open}
			onOpenChange={onOpenChange}
			dialogContentClassName="sm:max-w-[560px]"
			sheetContentClassName="p-6"
		>
			<DialogHeader>
				<DialogTitle>Add Linked Integration</DialogTitle>
			</DialogHeader>
			<div className="space-y-3">
				<Input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Search by name or short ID"
				/>
				<div className="max-h-80 space-y-2 overflow-y-auto pr-1">
					{definitionsState.isLoading || linkedActionsState.isLoading ? (
						<p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" />
							Loading actions...
						</p>
					) : filtered.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No available actions.
						</p>
					) : (
						filtered.map((definition) => (
							<div
								key={definition.id}
								className="flex items-center justify-between rounded-md border px-3 py-2"
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">
										{definition.name}
									</p>
									<p className="truncate text-xs text-muted-foreground">
										{definition.shortId} · {definition.type}
									</p>
								</div>
								<Button
									size="sm"
									disabled={readOnly}
									onClick={() => {
										void attachToTask({
											taskId,
											linkedActionId: definition.id,
										})
											.then(() => onOpenChange(false))
											.catch(onMutationError);
									}}
								>
									Add
								</Button>
							</div>
						))
					)}
				</div>
			</div>
		</ResponsiveModal>
	);
}

export function TaskLinkedActionsSection({
	task,
	readOnly = false,
}: TaskLinkedActionsSectionProps) {
	const linkedActionsResult = useQuery(api.linkedActions.listForTask, {
		taskId: task.id,
	});
	const linkedActionsState = useRetainedQueryResult(
		linkedActionsResult,
		task.id,
	);
	const detachFromTask = useMutation(api.linkedActions.detachFromTask);
	const confirmCanvaManualShareComplete = useMutation(
		api.linkedActions.confirmCanvaManualShareComplete,
	);
	const confirmWcaEventsConfirmation = useMutation(
		api.linkedActions.confirmWcaEventsManualConfirmation,
	);
	const runTaskLinkedAction = useAction(api.linkedActions.runTaskLinkedAction);
	const completeLinkedSheetShareWithLaptops = useAction(
		api.linkedActions.completeLinkedSheetShareWithLaptops,
	);
	const linkTaskCanvaDesign = useAction(api.linkedActions.linkTaskCanvaDesign);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [runningId, setRunningId] = useState<TaskLinkedAction["id"] | null>(
		null,
	);
	const [confirmingId, setConfirmingId] = useState<
		TaskLinkedAction["id"] | null
	>(null);
	const [linkingId, setLinkingId] = useState<TaskLinkedAction["id"] | null>(
		null,
	);
	const [sharingSheetId, setSharingSheetId] = useState<
		TaskLinkedAction["id"] | null
	>(null);
	const [confirmingEventsId, setConfirmingEventsId] = useState<
		TaskLinkedAction["id"] | null
	>(null);

	const items = linkedActionsState.data ?? [];

	const runAction = (
		item: TaskLinkedAction,
		options?: { overwriteEvents?: boolean },
	) => {
		if (readOnly || !item.canRun) return;
		setRunningId(item.id);
		void runTaskLinkedAction({
			taskId: task.id,
			taskLinkedActionId: item.id,
			overwriteEvents: options?.overwriteEvents,
		})
			.then((result) => {
				if (result.success) {
					toast.success(result.message);
				} else {
					toast.error(result.message);
				}
			})
			.catch(onMutationError)
			.finally(() => setRunningId(null));
	};

	const confirmManualShare = (item: TaskLinkedAction) => {
		if (readOnly || !item.canRun) return;
		setConfirmingId(item.id);
		void confirmCanvaManualShareComplete({
			taskId: task.id,
			taskLinkedActionId: item.id,
		})
			.catch(onMutationError)
			.finally(() => setConfirmingId(null));
	};

	const manualLinkCanvaDesign = (
		item: TaskLinkedAction,
		designInput: string,
	): Promise<boolean> => {
		if (readOnly || !item.canRun) return Promise.resolve(false);
		setLinkingId(item.id);
		return linkTaskCanvaDesign({
			taskId: task.id,
			taskLinkedActionId: item.id,
			designInput,
		})
			.then((result) => {
				if (result.success) {
					toast.success(result.message);
					return true;
				}
				onMutationError(new Error(result.message));
				return false;
			})
			.catch((error) => {
				onMutationError(error);
				return false;
			})
			.finally(() => setLinkingId(null));
	};

	const shareSheetWithLaptops = (item: TaskLinkedAction) => {
		if (readOnly || !item.canRun) return;
		setSharingSheetId(item.id);
		void completeLinkedSheetShareWithLaptops({
			taskId: task.id,
			taskLinkedActionId: item.id,
		})
			.then((result) => {
				if (result.success) {
					toast.success(result.message);
				} else {
					toast.error(result.message);
				}
			})
			.catch(onMutationError)
			.finally(() => setSharingSheetId(null));
	};

	const confirmEvents = (item: TaskLinkedAction) => {
		if (readOnly || !item.canRun) return;
		setConfirmingEventsId(item.id);
		void confirmWcaEventsConfirmation({
			taskId: task.id,
			taskLinkedActionId: item.id,
		})
			.catch(onMutationError)
			.finally(() => setConfirmingEventsId(null));
	};

	function parseOutputJson(
		outputJson: string | null,
	): Record<string, unknown> | null {
		if (!outputJson) return null;
		try {
			return JSON.parse(outputJson) as Record<string, unknown>;
		} catch {
			return null;
		}
	}

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2 px-0.5 py-1">
				<h3 className="flex items-center gap-1.5 text-sm font-semibold">
					<Link2 className="size-4" />
					Linked Integrations
					<Badge variant="secondary">{items.length}</Badge>
				</h3>
				<Button
					variant="outline"
					size="sm"
					disabled={readOnly}
					onClick={() => setIsAddDialogOpen(true)}
				>
					<Plus className="mr-1 size-3.5" />
					Add
				</Button>
			</div>

			{linkedActionsState.isLoading ? (
				<div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
					<span className="inline-flex items-center gap-2">
						<Loader2 className="size-4 animate-spin" />
						Loading linked integrations...
					</span>
				</div>
			) : items.length === 0 ? (
				<div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
					No linked integrations attached
				</div>
			) : (
				<div className="space-y-2">
					{items.map((item) => (
						<article
							key={item.id}
							className="space-y-3 rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm"
						>
							<div className="flex flex-wrap items-start justify-between gap-2">
								<div className="min-w-0">
									<div className="flex items-center gap-1.5">
										{(() => {
											const Icon = ACTION_ICON[item.definition.type];
											return <Icon className="size-4 text-muted-foreground" />;
										})()}
										<p className="truncate text-sm font-semibold">
											{item.definition.name}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-1.5">
									<LinkedActionStatusBadge
										status={item.status}
										actionType={item.definition.type}
									/>
									<Button
										variant="ghost"
										size="icon-xs"
										disabled={readOnly}
										onClick={() => {
											void detachFromTask({
												taskId: task.id,
												taskLinkedActionId: item.id,
											}).catch(onMutationError);
										}}
										title="Remove linked integration"
									>
										<Trash2 className="size-3.5 text-muted-foreground" />
									</Button>
								</div>
							</div>
							{item.definition.type === "canva_template" &&
							isCanvaConfig(item.definition.config) ? (
								<CanvaTemplatePane
									item={item}
									isRunning={runningId === item.id || item.status === "running"}
									isConfirming={confirmingId === item.id}
									isLinking={linkingId === item.id}
									isReadOnly={readOnly || !item.canRun}
									onRun={() => runAction(item)}
									onConfirmManualShare={() => confirmManualShare(item)}
									onManualLink={(designInput) =>
										manualLinkCanvaDesign(item, designInput)
									}
								/>
							) : null}
							{item.definition.type === "linked_sheet" &&
							isLinkedSheetConfig(item.definition.config)
								? (() => {
										const output = parseOutputJson(item.lastOutputJson);
										const eventsEditUrl =
											typeof output?.eventsEditUrl === "string"
												? output.eventsEditUrl
												: null;
										return (
											<LinkedSheetPane
												config={item.definition.config}
												status={item.status}
												isRunning={
													runningId === item.id || item.status === "running"
												}
												isSharingWithLaptops={sharingSheetId === item.id}
												isConfirmingEvents={confirmingEventsId === item.id}
												isReadOnly={readOnly || !item.canRun}
												eventsEditUrl={eventsEditUrl}
												onRun={(overwriteEvents) =>
													runAction(item, { overwriteEvents })
												}
												onShareWithLaptops={() => shareSheetWithLaptops(item)}
												onConfirmEvents={() => confirmEvents(item)}
											/>
										);
									})()
								: null}
							<LinkedActionStateNote
								status={item.status}
								canRun={item.canRun}
								isReadOnlyMode={readOnly}
							/>
							{item.lastRunMessage && item.status === "error" ? (
								<p className="text-xs text-muted-foreground">
									{item.lastRunMessage}
								</p>
							) : null}
						</article>
					))}
				</div>
			)}

			<AddLinkedActionDialog
				open={isAddDialogOpen}
				onOpenChange={setIsAddDialogOpen}
				taskId={task.id}
				readOnly={readOnly}
			/>
		</div>
	);
}
