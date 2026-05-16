import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import {
	AlertTriangle,
	Bell,
	Check,
	CheckCircle2,
	Clock,
	Link2,
	Loader2,
	Plus,
	Shield,
	Trash2,
	XCircle,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { CommentsSection } from "@/components/tasks/comments-section";
import { RemindMeDialog } from "@/components/tasks/remind-me-dialog";
import { useTaskColumns } from "@/components/tasks/columns";
import { TasksDataTable } from "@/components/tasks/data-table";
import { TaskListGroup } from "@/components/tasks/task-list-group";
import { TaskModal } from "@/components/tasks/task-modal";
import { TaskLinkedActionsSection } from "@/components/tasks/task-linked-actions";
import { TaskReminderStrip } from "@/components/tasks/task-reminder-strip";
import {
	AddApproverDialog,
	AddBlockingTaskDialog,
} from "@/components/tasks/task-dialogs";
import {
	EditableTaskAssignee,
	EditableTaskOwner,
	EditableTaskPriority,
	EditableTaskStatus,
} from "@/components/tasks/editable-cells";
import { PropertyRow } from "@/components/shared/property-editors/property-row";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { requireTaskId } from "@/lib/convex-ids";
import { getTaskBreadcrumbs } from "@/lib/task-breadcrumbs";
import { sortTasksByStatusThenPriority } from "@/lib/task-utils";
import { api } from "@/convex/_generated/api";
import {
	buildOneTimeReminderPayload,
	useNotificationMutations,
	useTaskSubscriptionState,
	useTask,
	useTasks,
	useTaskMutations,
	useCompetitions,
	useReminderMutations,
} from "@/hooks/use-convex-data";
import { useIsDirector } from "@/hooks/convex/use-admin";
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";
import { useDebouncedForm } from "@/hooks/use-debounced-form";
import type { Task, Team, User } from "@/data/types-new";
import { cn, onMutationError } from "@/lib/utils";

export const Route = createFileRoute("/tasks/$id")({
	component: RouteComponent,
});

function TaskHeader({ task }: { task: Task }) {
	const { tasks } = useTasks(false);
	const { competitions } = useCompetitions();
	const breadcrumbs = useMemo(
		() => getTaskBreadcrumbs(task, tasks, competitions),
		[task, tasks, competitions],
	);

	return (
		<PageHeader.Root withBottomBorder={false}>
			<SidebarTrigger className="shrink-0" />
			<PageHeader.Divider />
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<nav aria-label="Breadcrumb">
					<Breadcrumb>
						<BreadcrumbList>
							{breadcrumbs.map((entry, i) => (
								<Fragment
									key={entry.to ? `${entry.to}-${entry.label}` : "current"}
								>
									{i > 0 && <BreadcrumbSeparator />}
									<BreadcrumbItem>
										{entry.to ? (
											<BreadcrumbLink asChild>
												<Link
													to={entry.to}
													className="max-w-[120px] truncate sm:max-w-[200px]"
												>
													{entry.label}
												</Link>
											</BreadcrumbLink>
										) : (
											<BreadcrumbPage className="max-w-[120px] truncate sm:max-w-[200px]">
												{entry.label}
											</BreadcrumbPage>
										)}
									</BreadcrumbItem>
								</Fragment>
							))}
						</BreadcrumbList>
					</Breadcrumb>
				</nav>
				{task.owner && "members" in task.owner && (
					<>
						<PageHeader.Divider className="mx-2" />
						<Link
							to="/teams/$teamId"
							params={{ teamId: task.owner.id }}
							className="max-w-[170px] sm:max-w-[220px] shrink-0"
						>
							<Badge variant="outline" asChild className="gap-1">
								<span>
									<span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[8px]">
										T
									</span>
									<span className="truncate max-w-[160px]">
										{task.owner.name}
									</span>
								</span>
							</Badge>
						</Link>
					</>
				)}
			</div>
		</PageHeader.Root>
	);
}

function ApprovalBadge({
	approver,
	isApproved,
	canToggleApproval,
	isCurrentUser,
	onRemove,
	onApprove,
	onUnapprove,
}: {
	approver: Team | User;
	isApproved: boolean;
	canToggleApproval: boolean;
	isCurrentUser: boolean;
	onRemove: () => void;
	onApprove: () => void;
	onUnapprove: () => void;
}) {
	const isTeam = "members" in approver;

	return (
		<div
			className={cn(
				"flex items-center gap-2 px-2 py-1.5 rounded-md border text-sm group",
				isApproved
					? "border-success/30 bg-success/10"
					: "border-muted bg-muted/50",
			)}
		>
			<div
				className={cn(
					"flex items-center justify-center w-5 h-5 rounded-full",
					isApproved ? "text-success" : "bg-muted-foreground/20",
				)}
			>
				{isApproved ? (
					<Check className="size-3" />
				) : (
					<Clock className="size-3 text-muted-foreground" />
				)}
			</div>

			<div className="flex-1 min-w-0">
				<div className="font-medium truncate">{approver.name}</div>
				<div
					className={cn(
						"text-xs",
						isApproved ? "text-success" : "text-muted-foreground",
					)}
				>
					{isTeam ? "Team" : isCurrentUser ? "You" : "User"} •{" "}
					{isApproved ? "Approved" : "Pending"}
				</div>
			</div>

			<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
				{canToggleApproval &&
					(isApproved ? (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={onUnapprove}
							title="Unapprove"
						>
							<XCircle className="size-3.5 text-error-foreground" />
						</Button>
					) : (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={onApprove}
							title="Approve"
						>
							<CheckCircle2 className="size-3.5 text-success" />
						</Button>
					))}
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={onRemove}
					title="Remove approver"
				>
					<Trash2 className="size-3.5 text-muted-foreground" />
				</Button>
			</div>
		</div>
	);
}

function SubTasksList({ task }: { task: Task }) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const columns = useTaskColumns({ parentDisplayMode: "none" });
	const { tasks } = useTasks(false);
	const subTasks = useMemo(
		() =>
			sortTasksByStatusThenPriority(
				tasks.filter(
					(t) => t.parent?.type === "task" && t.parent.linkedId === task.id,
				),
			),
		[tasks, task.id],
	);
	const progress = useMemo(() => {
		const relevant = subTasks.filter((t) => t.status !== "cancelled");
		return {
			done: relevant.filter((t) => t.status === "done").length,
			inProgress: relevant.filter((t) => t.status === "in-progress").length,
			total: relevant.length,
		};
	}, [subTasks]);

	return (
		<>
			<TaskListGroup
				title="Sub-tasks"
				countLabel={`${subTasks.length} task${subTasks.length === 1 ? "" : "s"}`}
				isCollapsed={isCollapsed}
				onToggle={() => setIsCollapsed((prev) => !prev)}
				headerMeta={
					<div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
						{progress.total > 0 ? (
							<span>
								<span className="font-medium text-foreground">
									{progress.done}
								</span>{" "}
								done
							</span>
						) : null}
						{progress.total > 0 ? (
							<span>
								<span className="font-medium text-foreground">
									{progress.inProgress}
								</span>{" "}
								in progress
							</span>
						) : null}
						<button
							type="button"
							className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/60"
							onClick={() => setIsModalOpen(true)}
						>
							<Plus className="size-3" />
							Add sub-task
						</button>
					</div>
				}
			>
				<div className="min-w-0 w-full max-w-full overflow-hidden rounded-md border border-border">
					<TasksDataTable
						columns={columns}
						tasks={subTasks}
						filters={{
							status: [],
							priority: [],
							assignee: [],
							labels: [],
							owner: [],
							parentType: [],
						}}
						matchMode="all"
						grouping={null}
						subGrouping={null}
						ordering={{ field: null, direction: "asc" }}
						onOrderingChange={() => {}}
					/>
				</div>
			</TaskListGroup>

			<TaskModal
				open={isModalOpen}
				onOpenChange={setIsModalOpen}
				defaultParent={{ type: "task", linkedId: task.id }}
			/>
		</>
	);
}

function RouteComponent() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const taskId = requireTaskId(id);
	const task = useTask(taskId);
	const {
		updateTask,
		deleteTask,
		addRequiredApprover,
		removeRequiredApprover,
		addBlockingRelation,
		removeBlockingRelation,
		approveTask,
		unapproveTask,
	} = useTaskMutations();
	const isSubscribed = useTaskSubscriptionState(taskId);
	const { subscribeToTask, unsubscribeFromTask } = useNotificationMutations();
	const { addReminder } = useReminderMutations();
	const currentUserResult = useQuery(api.core.users.getCurrentUser);
	const { data: currentUser } = useRetainedQueryResult(currentUserResult);
	const { isDirector } = useIsDirector();

	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [remindMeOpen, setRemindMeOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
	const [isApproverDialogOpen, setIsApproverDialogOpen] = useState(false);
	const [isBlockingDialogOpen, setIsBlockingDialogOpen] = useState(false);

	const handleToggleSubscription = () => {
		if (isSubscribed) {
			void unsubscribeFromTask(taskId).catch(onMutationError);
			return;
		}
		void subscribeToTask(taskId).catch(onMutationError);
	};

	const titleForm = useDebouncedForm({
		initialValue: task?.title ?? "",
		onChange: (newTitle) => {
			if (newTitle.trim() && newTitle !== task?.title) {
				void updateTask(taskId, { title: newTitle.trim() }).catch(
					onMutationError,
				);
			}
		},
		debounceMs: 250,
	});

	const descriptionForm = useDebouncedForm({
		initialValue: task?.description ?? "",
		onChange: (newDescription) => {
			if (newDescription !== task?.description) {
				void updateTask(taskId, { description: newDescription }).catch(
					onMutationError,
				);
			}
		},
		debounceMs: 250,
	});

	// Approval status calculation
	const approvalStatus = useMemo(() => {
		if (!task) return null;
		const required = task.requiredApprovalBy;
		const approved = task.approvedBy;
		const approvedUserIds = new Set(approved.map((a) => a.id));
		const isApproved = (approver: Team | User): boolean => {
			if ("members" in approver) {
				return approver.members.some((m) => approvedUserIds.has(m.id));
			}
			return approvedUserIds.has(approver.id);
		};

		const approvedCount = required.filter(isApproved).length;

		return {
			required,
			approved,
			approvedCount,
			requiredCount: required.length,
			isFullyApproved: required.length > 0 && required.every(isApproved),
			pending: required.filter((r) => !isApproved(r)),
			isApproved,
		};
	}, [task]);

	const isCurrentUserApprover = (approver: Team | User) => {
		if ("members" in approver) {
			return approver.members.some((m) => m.id === currentUser?._id);
		}
		return approver.id === currentUser?._id;
	};

	const handleAddApprover = (approver: Team | User) => {
		if (!task) return;
		void addRequiredApprover(task.id, approver).catch(onMutationError);
	};

	const handleRemoveApprover = (approverId: string) => {
		if (!task) return;
		const approver = task.requiredApprovalBy.find((a) => a.id === approverId);
		if (!approver) return;
		const approverKey =
			"members" in approver ? `team:${approverId}` : `user:${approverId}`;
		void removeRequiredApprover(task.id, approverKey).catch(onMutationError);
	};

	const handleApprove = () => {
		if (!task) return;
		void approveTask(task.id).catch(onMutationError);
	};

	const handleUnapprove = () => {
		if (!task) return;
		void unapproveTask(task.id).catch(onMutationError);
	};

	const handleAddBlockingTask = (blockingTaskId: Task["id"]) => {
		if (!task) return;
		void addBlockingRelation(task.id, blockingTaskId).catch(onMutationError);
	};

	const handleRemoveBlockingTask = (blockingTaskId: Task["id"]) => {
		if (!task) return;
		void removeBlockingRelation(task.id, blockingTaskId).catch(onMutationError);
	};

	const handleRemoveBlockedTask = (blockedTaskId: Task["id"]) => {
		if (!task) return;
		void removeBlockingRelation(blockedTaskId, task.id).catch(onMutationError);
	};

	if (task === undefined) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (task === null) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<h2 className="text-lg font-medium">Task not found</h2>
					<p className="text-muted-foreground">
						The task you&apos;re looking for doesn&apos;t exist.
					</p>
					<Link to="/tasks">
						<Button className="mt-4">Back to Tasks</Button>
					</Link>
				</div>
			</div>
		);
	}

	const handleTitleEditStart = () => {
		titleForm.reset();
		setIsEditingTitle(true);
	};

	const handleTitleEditEnd = () => {
		titleForm.commit();
		setIsEditingTitle(false);
	};

	const handleDescriptionEditStart = () => {
		descriptionForm.reset();
		setIsEditingDescription(true);
	};

	const handleDescriptionEditEnd = () => {
		descriptionForm.commit();
		setIsEditingDescription(false);
	};

	const handleSetReminder = (remindAt: string, message?: string) => {
		void addReminder(
			buildOneTimeReminderPayload(task.id, remindAt, message),
		).catch(onMutationError);
	};

	const handleDeleteConfirm = async () => {
		setDeleteDialogOpen(false);
		try {
			await deleteTask(task.id);
		} catch (error) {
			onMutationError(error);
			return;
		}
		const parentId = task.parent?.type === "task" ? task.parent.linkedId : null;
		void navigate(
			parentId
				? { to: "/tasks/$id", params: { id: parentId } }
				: { to: "/tasks" },
		);
	};

	const unresolvedBlockers = task.blockedBy.filter(
		(relation) => !relation.isResolved,
	);

	return (
		<div className="flex h-full flex-col overflow-x-hidden">
			<TaskHeader task={task} />
			<div className="flex-1 overflow-auto px-3 pb-4 pt-0 sm:px-4 sm:pb-5 sm:pt-0 lg:px-6 lg:pb-6 lg:pt-0">
				<div className="mx-auto w-full max-w-3xl space-y-4 pb-10 sm:space-y-5">
					<TaskReminderStrip task={task} />

					{task.isBlocked && unresolvedBlockers.length > 0 && (
						<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5">
							<div className="flex items-center gap-2 text-sm font-medium text-warning">
								<AlertTriangle className="size-4" />
								Blocked by {unresolvedBlockers.length} task
								{unresolvedBlockers.length === 1 ? "" : "s"}
							</div>
							<div className="mt-1 space-y-1 text-sm">
								{unresolvedBlockers.map((relation) => (
									<div key={relation.task.id} className="min-w-0">
										<Link
											to="/tasks/$id"
											params={{ id: relation.task.id }}
											className="underline underline-offset-2 wrap-break-word"
										>
											{relation.task.identifier} {relation.task.title}
										</Link>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Main task card with title, description */}
					<section className="rounded-xl border border-border/70 bg-card">
						<div className="px-4 py-4 sm:px-5 sm:py-5 border-b border-border/50">
							<div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
								<span className="font-mono">{task.identifier}</span>
							</div>
							{isEditingTitle ? (
								<Input
									value={titleForm.value}
									onChange={titleForm.handleChange}
									onBlur={handleTitleEditEnd}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleTitleEditEnd();
										if (e.key === "Escape") setIsEditingTitle(false);
									}}
									className="border-0 px-0 text-xl font-bold focus-visible:ring-0 sm:text-2xl"
									autoFocus
								/>
							) : (
								<button
									type="button"
									className="cursor-pointer rounded px-1 -mx-1 text-left text-xl font-bold hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-2xl text-balance"
									onClick={handleTitleEditStart}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											handleTitleEditStart();
										}
									}}
								>
									{task.title}
								</button>
							)}
						</div>

						<div className="px-4 py-3 sm:px-5">
							<div className="flex items-center justify-between gap-2 mb-2">
								<h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									Description
								</h2>
								{!isEditingDescription && (
									<Button
										size="xs"
										variant="ghost"
										className="px-2 text-xs"
										onClick={handleDescriptionEditStart}
									>
										Edit
									</Button>
								)}
							</div>
							{isEditingDescription ? (
								<Textarea
									value={descriptionForm.value}
									onChange={descriptionForm.handleChange}
									onBlur={handleDescriptionEditEnd}
									className="min-h-[150px] resize-none"
									placeholder="Add description..."
									autoFocus
								/>
							) : task.description ? (
								<div className="prose prose-sm max-w-none dark:prose-invert sm:prose-base">
									<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
										{task.description}
									</ReactMarkdown>
								</div>
							) : (
								<button
									type="button"
									className="min-h-[60px] w-full cursor-pointer rounded p-2 -m-2 text-left text-sm text-muted-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									onClick={handleDescriptionEditStart}
								>
									Click to add description...
								</button>
							)}
						</div>
						<div className="flex items-center gap-2 border-t border-border/50 px-4 py-3 sm:px-5">
							<Button
								variant={isSubscribed ? "secondary" : "outline"}
								size="sm"
								onClick={handleToggleSubscription}
								className="gap-1.5"
							>
								<Bell className="size-4" />
								{isSubscribed ? "Watching" : "Watch"}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setRemindMeOpen(true)}
								className="gap-1.5"
							>
								<Bell className="size-4" />
								Remind me
							</Button>
						</div>
					</section>

					{/* Properties and Dependencies side-by-side on larger screens */}
					<div className="grid gap-4 md:grid-cols-2">
						<section className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5 sm:py-5">
							<h3 className="text-sm font-semibold mb-3">Properties</h3>
							<div className="space-y-1">
								<PropertyRow label="Status">
									<EditableTaskStatus
										status={task.status}
										taskId={task.id}
										task={task}
									/>
								</PropertyRow>
								<PropertyRow label="Priority">
									<EditableTaskPriority
										priority={task.priority}
										taskId={task.id}
									/>
								</PropertyRow>
								<PropertyRow label="Assignee">
									<EditableTaskAssignee
										assignee={task.assignee}
										taskId={task.id}
									/>
								</PropertyRow>
								<PropertyRow label="Owner">
									<EditableTaskOwner owner={task.owner} taskId={task.id} />
								</PropertyRow>
								<PropertyRow label="Due date">
									<DropdownMenu
										open={isDatePickerOpen}
										onOpenChange={setIsDatePickerOpen}
									>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 min-w-0 max-w-full px-2"
											>
												{task.dueDate ? (
													<span className="max-w-full truncate text-sm">
														{format(new Date(task.dueDate), "MMM d, yyyy")}
													</span>
												) : (
													<span className="max-w-full truncate text-sm text-muted-foreground">
														Set due date...
													</span>
												)}
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent className="w-auto p-0" align="end">
											<Calendar
												mode="single"
												selected={
													task.dueDate ? new Date(task.dueDate) : undefined
												}
												onSelect={(date) => {
													void updateTask(task.id, {
														dueDate: date
															? date.toISOString().split("T")[0]
															: null,
													}).catch(onMutationError);
													setIsDatePickerOpen(false);
												}}
											/>
										</DropdownMenuContent>
									</DropdownMenu>
								</PropertyRow>
							</div>
						</section>

						<section className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5 sm:py-5">
							<div className="flex items-center justify-between mb-3">
								<h3 className="text-sm font-semibold flex items-center gap-2">
									<Link2 className="size-4" />
									Dependencies
								</h3>
								{task.isBlocked && (
									<span className="text-xs font-medium text-warning-foreground">
										{task.unresolvedBlockerCount} active
									</span>
								)}
							</div>

							<div className="space-y-3">
								<div>
									<div className="text-xs font-medium text-muted-foreground mb-1.5">
										Blocked by
									</div>
									{task.blockedBy.length === 0 ? (
										<div className="text-sm text-muted-foreground">
											No blocking tasks
										</div>
									) : (
										<div className="flex flex-col gap-1.5">
											{task.blockedBy.map((relation) => (
												<div
													key={relation.task.id}
													className={cn(
														"flex min-w-0 items-start gap-2 rounded-md border px-2 py-1.5 text-sm",
														relation.isResolved
															? "border-success/30 bg-success/10"
															: "border-warning/30 bg-warning/10",
													)}
												>
													{relation.isResolved ? (
														<CheckCircle2 className="size-4 shrink-0 text-success" />
													) : (
														<AlertTriangle className="size-4 shrink-0 text-warning" />
													)}
													<div className="min-w-0 flex-1">
														<Link
															to="/tasks/$id"
															params={{ id: relation.task.id }}
															className="block font-medium leading-snug wrap-break-words hover:underline underline-offset-2 text-xs"
														>
															{relation.task.identifier} {relation.task.title}
														</Link>
													</div>
													<Button
														variant="ghost"
														size="icon"
														className="h-5 w-5 shrink-0"
														onClick={() =>
															handleRemoveBlockingTask(relation.task.id)
														}
														title="Remove blocker"
													>
														<Trash2 className="size-3 text-muted-foreground" />
													</Button>
												</div>
											))}
										</div>
									)}
								</div>

								<div>
									<div className="text-xs font-medium text-muted-foreground mb-1.5">
										Blocks
									</div>
									{task.blocks.length === 0 ? (
										<div className="text-sm text-muted-foreground">
											Not blocking other tasks
										</div>
									) : (
										<div className="flex flex-col gap-1.5">
											{task.blocks.map((blockedTask) => (
												<div
													key={blockedTask.id}
													className="flex min-w-0 items-start gap-2 rounded-md border px-2 py-1.5 text-sm"
												>
													<Link2 className="size-4 shrink-0 text-muted-foreground" />
													<div className="min-w-0 flex-1">
														<Link
															to="/tasks/$id"
															params={{ id: blockedTask.id }}
															className="block font-medium leading-snug break-words [overflow-wrap:anywhere] hover:underline underline-offset-2 text-xs"
														>
															{blockedTask.identifier} {blockedTask.title}
														</Link>
													</div>
													<Button
														variant="ghost"
														size="icon"
														className="h-5 w-5 shrink-0"
														onClick={() =>
															handleRemoveBlockedTask(blockedTask.id)
														}
														title="Remove dependency"
													>
														<Trash2 className="size-3 text-muted-foreground" />
													</Button>
												</div>
											))}
										</div>
									)}
								</div>

								<Button
									variant="ghost"
									size="sm"
									className="justify-start text-muted-foreground hover:text-foreground w-full"
									onClick={() => setIsBlockingDialogOpen(true)}
								>
									<Plus className="size-3.5 mr-1.5" />
									Add blocker
								</Button>
							</div>
						</section>
					</div>

					{/* Approvals section */}
					{approvalStatus && (
						<section className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5 sm:py-5">
							<div className="flex items-center justify-between mb-3">
								<h3 className="text-sm font-semibold flex items-center gap-2">
									<Shield className="size-4" />
									Approvals
								</h3>
								{approvalStatus.requiredCount > 0 && (
									<span
										className={cn(
											"text-xs font-medium",
											approvalStatus.isFullyApproved
												? "text-success-foreground"
												: "text-warning-foreground",
										)}
									>
										{approvalStatus.approvedCount}/
										{approvalStatus.requiredCount}
									</span>
								)}
							</div>

							{approvalStatus.requiredCount === 0 ? (
								<div className="text-sm text-muted-foreground">
									No approvals required
								</div>
							) : (
								<div className="flex flex-col gap-1.5">
									{approvalStatus.required.map((approver) => {
										const isApproved = approvalStatus.isApproved(approver);
										return (
											<ApprovalBadge
												key={approver.id}
												approver={approver}
												isApproved={isApproved}
												canToggleApproval={
													isDirector || isCurrentUserApprover(approver)
												}
												isCurrentUser={isCurrentUserApprover(approver)}
												onRemove={() => handleRemoveApprover(approver.id)}
												onApprove={handleApprove}
												onUnapprove={handleUnapprove}
											/>
										);
									})}
								</div>
							)}

							<Button
								variant="ghost"
								size="sm"
								className="justify-start text-muted-foreground hover:text-foreground mt-2"
								onClick={() => setIsApproverDialogOpen(true)}
							>
								<Plus className="size-3.5 mr-1.5" />
								Add approver
							</Button>

							{task.status === "done" &&
								approvalStatus.requiredCount > 0 &&
								!approvalStatus.isFullyApproved && (
									<div className="mt-3 p-2 rounded-md bg-warning/10 border border-warning/20 text-xs text-warning-foreground">
										Task is marked done but missing required approvals (
										{approvalStatus.pending.length} pending)
									</div>
								)}
						</section>
					)}

					<TaskLinkedActionsSection task={task} readOnly={!task.canEdit} />

					<SubTasksList task={task} />

					<section className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5 sm:py-5">
						<CommentsSection taskId={task.id} className="mt-0" />
					</section>

					<Separator />

					{/* Metadata and delete */}
					<section className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5 sm:py-5">
						<div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
							<div>
								<span className="font-medium">Created:</span>{" "}
								{format(new Date(task.createdAt), "MMM d, yyyy")}
							</div>
							<div>
								<span className="font-medium">Updated:</span>{" "}
								{format(new Date(task.updatedAt), "MMM d, yyyy")}
							</div>
						</div>
						<div className="mt-4">
							<Button
								variant="destructive"
								size="sm"
								onClick={() => setDeleteDialogOpen(true)}
								className="gap-2"
							>
								<Trash2 className="size-4" />
								Delete task
							</Button>
						</div>
					</section>
				</div>
			</div>

			<AddBlockingTaskDialog
				open={isBlockingDialogOpen}
				onOpenChange={setIsBlockingDialogOpen}
				task={task}
				onAddBlockingTask={handleAddBlockingTask}
			/>
			<AddApproverDialog
				open={isApproverDialogOpen}
				onOpenChange={setIsApproverDialogOpen}
				task={task}
				onAdd={handleAddApprover}
			/>
			<RemindMeDialog
				open={remindMeOpen}
				onOpenChange={setRemindMeOpen}
				taskId={task.id}
				onSetReminder={handleSetReminder}
			/>
			<ConfirmDeleteDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				title="Delete task?"
				description={
					<>
						Are you sure you want to permanently delete &quot;{task.title}
						&quot;? This will delete all subtasks, sub-subtasks, comments,
						reactions, resources, reminders, and other associated data. This
						action cannot be undone.
					</>
				}
				onConfirm={handleDeleteConfirm}
			/>
		</div>
	);
}
