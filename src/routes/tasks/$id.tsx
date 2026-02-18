import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	Bell,
	CalendarClock,
	CircleCheck,
	Flag,
	MoreHorizontal,
	PanelRight,
	Plus,
	Trash2,
	UserRound,
	X,
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
import { TaskPropertiesSidebar } from "@/components/tasks/task-properties-sidebar";
import { TaskReminderStrip } from "@/components/tasks/task-reminder-strip";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { requireTaskId } from "@/lib/convex-ids";
import { priorityLabels, statusLabels } from "@/lib/task-constants";
import { getTaskBreadcrumbs } from "@/lib/task-breadcrumbs";
import { sortTasksByStatusThenPriority } from "@/lib/task-utils";
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
import { useDebouncedForm } from "@/hooks/use-debounced-form";
import type { Task } from "@/data/types-new";
import { onMutationError } from "@/lib/utils";

export const Route = createFileRoute("/tasks/$id")({
	component: RouteComponent,
});

function TaskQuickStat({
	label,
	value,
	meta,
	tone = "default",
}: {
	label: string;
	value: string;
	meta?: string;
	tone?: "default" | "success" | "warning" | "danger";
}) {
	const toneClass =
		tone === "success"
			? "text-success"
			: tone === "warning"
				? "text-warning"
				: tone === "danger"
					? "text-destructive"
					: "text-foreground";

	return (
		<div className="min-w-0 rounded-lg border border-border/70 bg-card p-3">
			<div className="text-[11px] uppercase tracking-wide text-muted-foreground">
				{label}
			</div>
			<div className={`mt-1 truncate text-sm font-semibold ${toneClass}`}>
				{value}
			</div>
			{meta ? (
				<div className="mt-0.5 truncate text-xs text-muted-foreground">
					{meta}
				</div>
			) : null}
		</div>
	);
}

function TaskHeader({
	task,
	onPropertiesClick,
	onRemindMeClick,
	isSubscribed,
	onToggleSubscription,
	onDeleteClick,
}: {
	task: Task;
	onPropertiesClick: () => void;
	onRemindMeClick: () => void;
	isSubscribed: boolean;
	onToggleSubscription: () => void;
	onDeleteClick?: () => void;
}) {
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
			<nav
				className="flex min-w-0 flex-1 items-center gap-2"
				aria-label="Breadcrumb"
			>
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
						className="max-w-[170px] sm:max-w-[220px]"
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
			<div className="ml-auto flex items-center gap-2">
				<Button
					variant={isSubscribed ? "secondary" : "outline"}
					size="sm"
					onClick={onToggleSubscription}
					className="gap-1.5"
				>
					<Bell className="size-4" />
					<span className="hidden sm:inline">
						{isSubscribed ? "Watching" : "Watch"}
					</span>
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={onPropertiesClick}
					className="gap-1.5 lg:hidden"
				>
					<PanelRight className="size-4" />
					<span className="hidden sm:inline">Properties</span>
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="gap-1.5">
							<MoreHorizontal className="size-4" />
							<span className="hidden sm:inline">Actions</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onRemindMeClick}>
							<Bell className="size-4 mr-2" />
							Remind me
						</DropdownMenuItem>
						{onDeleteClick && (
							<DropdownMenuItem
								onClick={onDeleteClick}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="size-4 mr-2" />
								Delete task
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
				<Link to="/tasks">
					<Button variant="ghost" size="icon">
						<X className="size-4" />
					</Button>
				</Link>
			</div>
		</PageHeader.Root>
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
	const { updateTask, deleteTask } = useTaskMutations();
	const isSubscribed = useTaskSubscriptionState(taskId);
	const { subscribeToTask, unsubscribeFromTask } = useNotificationMutations();
	const { addReminder } = useReminderMutations();

	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [propertiesPopoverOpen, setPropertiesPopoverOpen] = useState(false);
	const [remindMeOpen, setRemindMeOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

	if (!task) {
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
		await navigate(
			parentId
				? { to: "/tasks/$id", params: { id: parentId } }
				: { to: "/tasks" },
		);
	};
	const unresolvedBlockers = task.blockedBy.filter(
		(relation) => !relation.isResolved,
	);
	const dueDate = task.dueDate ? new Date(task.dueDate) : null;
	const isOverdue = Boolean(
		dueDate && task.status !== "done" && dueDate.getTime() < Date.now(),
	);
	const dueDateLabel = dueDate
		? dueDate.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			})
		: "No due date";
	const dueMeta = isOverdue ? "Overdue" : undefined;
	const assigneeLabel = task.assignee?.name ?? "Unassigned";
	const assigneeMeta = task.owner ? `Owner: ${task.owner.name}` : undefined;
	const statusLabel = statusLabels[task.status];
	const priorityLabel = priorityLabels[task.priority];

	return (
		<div className="flex h-full flex-col overflow-x-hidden">
			<TaskHeader
				task={task}
				onPropertiesClick={() => setPropertiesPopoverOpen(true)}
				onRemindMeClick={() => setRemindMeOpen(true)}
				isSubscribed={isSubscribed}
				onToggleSubscription={handleToggleSubscription}
				onDeleteClick={() => setDeleteDialogOpen(true)}
			/>
			<div className="flex flex-1 overflow-hidden">
				<div className="flex-1 overflow-auto px-3 pb-4 pt-0 sm:px-4 sm:pb-5 sm:pt-0 lg:px-6 lg:pb-6 lg:pt-0">
					<div className="mx-auto w-full max-w-5xl space-y-4 pb-10 sm:space-y-5">
						<TaskReminderStrip task={task} />
						{task.isBlocked && unresolvedBlockers.length > 0 && (
							<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5">
								<div className="flex items-center gap-2 text-sm font-medium text-warning-foreground">
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
						<section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							<TaskQuickStat
								label="Status"
								value={statusLabel}
								meta={task.identifier}
								tone={task.status === "done" ? "success" : "default"}
							/>
							<TaskQuickStat
								label="Priority"
								value={priorityLabel}
								tone={task.priority === "urgent" ? "danger" : "default"}
							/>
							<TaskQuickStat
								label="Due"
								value={dueDateLabel}
								meta={dueMeta}
								tone={isOverdue ? "danger" : "default"}
							/>
							<TaskQuickStat
								label="People"
								value={assigneeLabel}
								meta={assigneeMeta}
							/>
						</section>

						<section className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5 sm:py-5">
							<div className="mb-4 flex flex-wrap items-center gap-2">
								<Badge
									variant="outline"
									className="h-6 gap-1 border-border bg-background text-[11px] font-normal"
								>
									<CircleCheck className="size-3.5" />
									{statusLabel}
								</Badge>
								<Badge
									variant="outline"
									className="h-6 gap-1 border-border bg-background text-[11px] font-normal"
								>
									<Flag className="size-3.5" />
									{priorityLabel}
								</Badge>
								{dueDate && (
									<Badge
										variant="outline"
										className="h-6 gap-1 border-border bg-background text-[11px] font-normal"
									>
										<CalendarClock className="size-3.5" />
										{dueDate.toLocaleDateString(undefined, {
											month: "short",
											day: "numeric",
										})}
									</Badge>
								)}
								<Badge
									variant="outline"
									className="h-6 gap-1 border-border bg-background text-[11px] font-normal"
								>
									<UserRound className="size-3.5" />
									{task.owner?.name ?? "No owner"}
								</Badge>
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
									className="cursor-pointer rounded px-1 -mx-1 text-left text-xl font-bold hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-2xl"
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

							<div className="mt-4 space-y-2">
								<div className="flex items-center justify-between gap-2">
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
										className="min-h-[96px] w-full cursor-pointer rounded p-2 -m-2 text-left text-sm text-muted-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										onClick={handleDescriptionEditStart}
									>
										Click to add description...
									</button>
								)}
							</div>
						</section>

						<TaskLinkedActionsSection task={task} readOnly={!task.canEdit} />

						<SubTasksList task={task} />

						<section className="rounded-xl border border-border/70 bg-card px-4 py-4 sm:px-5 sm:py-5">
							<CommentsSection taskId={task.id} className="mt-0" />
						</section>
					</div>
				</div>

				<TaskPropertiesSidebar
					task={task}
					renderMode="sidebar"
					showMobileTrigger={false}
					onDeleteClick={() => setDeleteDialogOpen(true)}
				/>
			</div>

			<TaskPropertiesSidebar
				task={task}
				renderMode="popover"
				open={propertiesPopoverOpen}
				onOpenChange={setPropertiesPopoverOpen}
				onDeleteClick={() => setDeleteDialogOpen(true)}
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
