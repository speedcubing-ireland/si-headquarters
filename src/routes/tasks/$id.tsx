import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { CommentsSection } from "@/components/tasks/comments-section";
import { EditableTaskStatus } from "@/components/tasks/editable-cells";
import { RemindMeDialog } from "@/components/tasks/remind-me-dialog";
import { TaskModal } from "@/components/tasks/task-modal";
import { TaskPropertiesSidebar } from "@/components/tasks/task-properties-sidebar";
import { TaskReminderStrip } from "@/components/tasks/task-reminder-strip";
import { TaskResourcesSection } from "@/components/tasks/task-resources";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getTaskBreadcrumbs } from "@/lib/task-breadcrumbs";
import {
	buildOneTimeReminderPayload,
	useTask,
	useTasks,
	useTaskMutations,
	useCompetitions,
	useReminderMutations,
} from "@/hooks/use-convex-data";
import { useDebouncedForm } from "@/hooks/use-debounced-form";
import type { Task } from "@/data/types-new";

export const Route = createFileRoute("/tasks/$id")({
	component: RouteComponent,
});

function TaskHeader({
	task,
	onPropertiesClick,
	onRemindMeClick,
	onDeleteClick,
}: {
	task: Task;
	onPropertiesClick: () => void;
	onRemindMeClick: () => void;
	onDeleteClick?: () => void;
}) {
	const { tasks } = useTasks(false);
	const { competitions } = useCompetitions();
	const breadcrumbs = useMemo(
		() => getTaskBreadcrumbs(task, tasks, competitions),
		[task, tasks, competitions],
	);

	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
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
												className="max-w-[140px] truncate sm:max-w-[200px]"
											>
												{entry.label}
											</Link>
										</BreadcrumbLink>
									) : (
										<BreadcrumbPage className="max-w-[140px] truncate sm:max-w-[200px]">
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
					<Separator
						orientation="vertical"
						className="mx-2 h-4 hidden sm:block"
					/>
					<Link
						to="/teams/$teamId"
						params={{ teamId: task.owner.id }}
						className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted ml-1 sm:inline-flex"
					>
						<span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[8px]">
							T
						</span>
						<span className="truncate max-w-[160px]">{task.owner.name}</span>
					</Link>
				</>
			)}
			<div className="ml-auto flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={onPropertiesClick}
					className="lg:hidden gap-1.5"
				>
					<span className="hidden sm:inline">Properties</span>
					<MoreHorizontal className="size-4 sm:hidden" />
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon">
							<MoreHorizontal className="size-4" />
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
		</header>
	);
}

function SubTasksList({ task }: { task: Task }) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const { tasks } = useTasks(false);
	const subTasks = useMemo(
		() =>
			tasks.filter(
				(t) => t.parent?.type === "task" && t.parent.linkedId === task.id,
			),
		[tasks, task.id],
	);
	const progress = useMemo(() => {
		const relevant = subTasks.filter((t) => t.status !== "cancelled");
		return {
			done: relevant.filter((t) => t.status === "done").length,
			total: relevant.length,
		};
	}, [subTasks]);

	return (
		<div className="mt-6">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-medium">Sub-tasks</h3>
				{progress.total > 0 && (
					<span className="text-xs text-muted-foreground">
						{progress.done}/{progress.total} done
					</span>
				)}
			</div>
			<div className="space-y-2">
				{subTasks.map((subTask) => {
					return (
						<div
							key={subTask.id}
							className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50"
						>
							<EditableTaskStatus status={subTask.status} taskId={subTask.id} />
							<Link
								to="/tasks/$id"
								params={{ id: subTask.id }}
								className={`text-sm flex-1 truncate hover:underline ${subTask.status === "done" ? "line-through text-muted-foreground" : ""}`}
							>
								{subTask.title}
							</Link>
						</div>
					);
				})}

				<Button
					variant="ghost"
					size="sm"
					className="text-muted-foreground"
					onClick={() => setIsModalOpen(true)}
				>
					<Plus className="size-4 mr-1" />
					Add sub-task
				</Button>

				<TaskModal
					open={isModalOpen}
					onOpenChange={setIsModalOpen}
					defaultParent={{ type: "task", linkedId: task.id }}
				/>
			</div>
		</div>
	);
}

function RouteComponent() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const task = useTask(id);
	const { updateTask, deleteTask } = useTaskMutations();
	const { addReminder } = useReminderMutations();

	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [propertiesPopoverOpen, setPropertiesPopoverOpen] = useState(false);
	const [remindMeOpen, setRemindMeOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	const titleForm = useDebouncedForm({
		initialValue: task?.title ?? "",
		onChange: (newTitle) => {
			if (newTitle.trim() && newTitle !== task?.title) {
				void updateTask(id, { title: newTitle.trim() });
			}
		},
		debounceMs: 250,
	});

	const descriptionForm = useDebouncedForm({
		initialValue: task?.description ?? "",
		onChange: (newDescription) => {
			if (newDescription !== task?.description) {
				void updateTask(id, { description: newDescription });
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
		void addReminder(buildOneTimeReminderPayload(task.id, remindAt, message));
	};

	const handleDeleteConfirm = async () => {
		setDeleteDialogOpen(false);
		await deleteTask(task.id);
		const parentId = task.parent?.type === "task" ? task.parent.linkedId : null;
		navigate(
			parentId
				? { to: "/tasks/$id", params: { id: parentId } }
				: { to: "/tasks" },
		);
	};

	return (
		<div className="flex flex-col h-full">
			<TaskHeader
				task={task}
				onPropertiesClick={() => setPropertiesPopoverOpen(true)}
				onRemindMeClick={() => setRemindMeOpen(true)}
				onDeleteClick={() => setDeleteDialogOpen(true)}
			/>
			<div className="flex flex-1 overflow-hidden">
				<div className="flex-1 overflow-auto p-6">
					<TaskReminderStrip task={task} />
					{isEditingTitle ? (
						<Input
							value={titleForm.value}
							onChange={titleForm.handleChange}
							onBlur={handleTitleEditEnd}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleTitleEditEnd();
								if (e.key === "Escape") setIsEditingTitle(false);
							}}
							className="text-2xl font-bold border-0 px-0 focus-visible:ring-0"
							autoFocus
						/>
					) : (
						<button
							type="button"
							className="text-left text-2xl font-bold cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
						<div className="flex items-center justify-between">
							<h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
								Description
							</h2>
							{!isEditingDescription && (
								<Button
									size="xs"
									variant="ghost"
									className="h-7 px-2 text-xs"
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
							<div className="prose dark:prose-invert max-w-none text-sm">
								<ReactMarkdown>{task.description}</ReactMarkdown>
							</div>
						) : (
							<button
								type="button"
								className="w-full text-left text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 min-h-[100px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={handleDescriptionEditStart}
							>
								Click to add description...
							</button>
						)}
					</div>

					<div className="mt-6">
						<TaskResourcesSection task={task} />
					</div>

					<SubTasksList task={task} />

					<CommentsSection taskId={task.id} />

					<ActivityFeed taskId={task.id} />
				</div>

				<TaskPropertiesSidebar
					task={task}
					renderMode="sidebar"
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
