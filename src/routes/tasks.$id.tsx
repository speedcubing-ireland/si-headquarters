import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ActivityFeed } from "@/components/tasks/activity-feed";
import { CommentsSection } from "@/components/tasks/comments-section";
import { EditableTaskStatus } from "@/components/tasks/editable-cells";
import { TaskModal } from "@/components/tasks/task-modal";
import { TaskPropertiesSidebar } from "@/components/tasks/task-properties-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useDataV2 } from "@/data/data-store-v2";
import type { Task } from "@/data/types-new";

export const Route = createFileRoute("/tasks/$id")({
	component: RouteComponent,
});

function TaskHeader({ task }: { task: Task }) {
	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
			<Link
				to="/tasks"
				className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				<span className="text-sm">Back to Tasks</span>
			</Link>
			<Separator orientation="vertical" className="mx-2 h-4" />
			<span className="text-sm font-mono text-muted-foreground">
				{task.identifier}
			</span>
			{task.owner && "members" in task.owner && (
				<>
					<Separator orientation="vertical" className="mx-2 h-4" />
					<Link
						to="/teams/$teamId"
						params={{ teamId: task.owner.id }}
						className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted ml-1"
					>
						<span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[8px]">
							T
						</span>
						<span className="truncate max-w-[160px]">{task.owner.name}</span>
					</Link>
				</>
			)}
			<div className="ml-auto flex items-center gap-2">
				<Button variant="ghost" size="icon">
					<MoreHorizontal className="size-4" />
				</Button>
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
	// Zustand v5 + React 19: selector results must be referentially stable.
	// `getTaskChildren()` creates a new array every call, which triggers the
	// "getSnapshot should be cached" dev error. Subscribe to `tasks` and derive.
	const tasks = useDataV2((state) => state.tasks);
	const getSubtaskProgress = useDataV2((state) => state.getSubtaskProgress);
	const subTasks = useMemo(
		() =>
			tasks.filter(
				(t) => t.parent?.type === "task" && t.parent.linkedId === task.id,
			),
		[tasks, task.id],
	);

	const progress = getSubtaskProgress(task.id);

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
					mode="create"
					defaultParent={{ type: "task", linkedId: task.id }}
				/>
			</div>
		</div>
	);
}

function RouteComponent() {
	const { id } = Route.useParams();
	const task = useDataV2((state) => state.getTaskById(id));
	const updateTask = useDataV2((state) => state.updateTask);

	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [editedTitle, setEditedTitle] = useState("");
	const [editedDescription, setEditedDescription] = useState("");

	if (!task) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<h2 className="text-lg font-medium">Task not found</h2>
					<p className="text-muted-foreground">
						The task you're looking for doesn't exist.
					</p>
					<Link to="/tasks">
						<Button className="mt-4">Back to Tasks</Button>
					</Link>
				</div>
			</div>
		);
	}

	const handleTitleEdit = () => {
		if (editedTitle.trim() && editedTitle !== task.title) {
			updateTask(id, { title: editedTitle.trim() });
		}
		setIsEditingTitle(false);
	};

	const handleDescriptionEdit = () => {
		if (editedDescription !== task.description) {
			updateTask(id, { description: editedDescription });
		}
		setIsEditingDescription(false);
	};

	return (
		<div className="flex flex-col h-full">
			<TaskHeader task={task} />
			<div className="flex flex-1 overflow-hidden">
				<div className="flex-1 overflow-auto p-6">
					{isEditingTitle ? (
						<Input
							value={editedTitle}
							onChange={(e) => setEditedTitle(e.target.value)}
							onBlur={handleTitleEdit}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleTitleEdit();
								if (e.key === "Escape") setIsEditingTitle(false);
							}}
							className="text-2xl font-bold border-0 px-0 focus-visible:ring-0"
							autoFocus
						/>
					) : (
						<button
							type="button"
							className="text-left text-2xl font-bold cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={() => {
								setEditedTitle(task.title);
								setIsEditingTitle(true);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									setEditedTitle(task.title);
									setIsEditingTitle(true);
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
									onClick={() => {
										setEditedDescription(task.description);
										setIsEditingDescription(true);
									}}
								>
									Edit
								</Button>
							)}
						</div>
						{isEditingDescription ? (
							<Textarea
								value={editedDescription}
								onChange={(e) => setEditedDescription(e.target.value)}
								onBlur={handleDescriptionEdit}
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
								onClick={() => {
									setEditedDescription(task.description);
									setIsEditingDescription(true);
								}}
							>
								Click to add description...
							</button>
						)}
					</div>

					<SubTasksList task={task} />

					<CommentsSection taskId={task.id} />

					<ActivityFeed taskId={task.id} />
				</div>

				<TaskPropertiesSidebar task={task} />
			</div>
		</div>
	);
}
