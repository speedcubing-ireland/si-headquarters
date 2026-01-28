import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { EditableTaskStatus } from "@/components/tasks/editable-cells";
import { TaskModal } from "@/components/tasks/task-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useDataV2 } from "@/data/data-store-v2";
import type {
	Task,
	TaskLabel,
	TaskPriority,
	TaskStatus,
	Team,
	User,
} from "@/data/types-new";
import { TASK_PRIORITY, TASK_STATUS } from "@/data/types-new";
import {
	priorityLabels,
	statusColors,
	statusLabels,
} from "@/lib/task-constants";
import {
	formatDate,
	getInitials,
	getPriorityIcon,
	getStatusIcon,
} from "@/lib/task-utils";

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

function TaskProperties({
	task,
	onUpdate,
}: {
	task: Task;
	onUpdate: (updates: Partial<Task>) => void;
}) {
	const users = useDataV2((state) => state.users);
	const teams = useDataV2((state) => state.teams);
	const labels = useDataV2((state) => state.labels);

	const StatusIcon = getStatusIcon(task.status);
	const PriorityIcon = getPriorityIcon(task.priority);

	return (
		<div className="w-72 border-l bg-muted/20 p-4 space-y-4">
			<div>
				<Label
					htmlFor="task-status"
					className="text-xs text-muted-foreground mb-1 block"
				>
					Status
				</Label>
				<Select
					value={task.status}
					onValueChange={(v) => onUpdate({ status: v as TaskStatus })}
				>
					<SelectTrigger id="task-status" className="w-full h-8">
						<Badge className={statusColors[task.status]}>
							<StatusIcon className="size-3 mr-1" />
							{statusLabels[task.status]}
						</Badge>
					</SelectTrigger>
					<SelectContent>
						{TASK_STATUS.map((s) => {
							const Icon = getStatusIcon(s);
							return (
								<SelectItem key={s} value={s}>
									<div className="flex items-center gap-2">
										<Icon className="size-4" />
										{statusLabels[s]}
									</div>
								</SelectItem>
							);
						})}
					</SelectContent>
				</Select>
			</div>

			<div>
				<Label className="text-xs text-muted-foreground mb-1 block">
					Owner
				</Label>
				<Select
					value={
						task.owner
							? "members" in task.owner
								? `team:${task.owner.id}`
								: `user:${task.owner.id}`
							: "unassigned"
					}
					onValueChange={(v) => {
						if (v === "unassigned") {
							onUpdate({ owner: null });
							return;
						}
						if (v.startsWith("team:")) {
							const id = v.slice("team:".length);
							const team: Team | null = teams.find((t) => t.id === id) ?? null;
							onUpdate({ owner: team });
							return;
						}
						if (v.startsWith("user:")) {
							const id = v.slice("user:".length);
							const user: User | null = users.find((u) => u.id === id) ?? null;
							onUpdate({ owner: user });
						}
					}}
				>
					<SelectTrigger className="w-full h-8">
						{task.owner ? (
							"members" in task.owner ? (
								<div className="flex items-center gap-2">
									<span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[8px]">
										T
									</span>
									<span className="text-sm">{task.owner.name}</span>
								</div>
							) : (
								<div className="flex items-center gap-2">
									<Avatar className="size-4">
										<AvatarImage src={task.owner.avatarUrl} />
										<AvatarFallback className="text-[8px]">
											{getInitials(task.owner.name)}
										</AvatarFallback>
									</Avatar>
									<span className="text-sm">{task.owner.name}</span>
								</div>
							)
						) : (
							<span className="text-muted-foreground text-sm">Unassigned</span>
						)}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="unassigned">Unassigned</SelectItem>
						{teams.length > 0 && (
							<>
								<SelectItem value="__teams_header" disabled>
									Teams
								</SelectItem>
								{teams.map((team) => (
									<SelectItem key={team.id} value={`team:${team.id}`}>
										<div className="flex items-center gap-2">
											<span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[8px]">
												T
											</span>
											{team.name}
										</div>
									</SelectItem>
								))}
							</>
						)}
						{users.length > 0 && (
							<>
								<SelectItem value="__users_header" disabled>
									Individuals
								</SelectItem>
								{users.map((user) => (
									<SelectItem key={user.id} value={`user:${user.id}`}>
										<div className="flex items-center gap-2">
											<Avatar className="size-4">
												<AvatarImage src={user.avatarUrl} />
												<AvatarFallback className="text-[8px]">
													{getInitials(user.name)}
												</AvatarFallback>
											</Avatar>
											{user.name}
										</div>
									</SelectItem>
								))}
							</>
						)}
					</SelectContent>
				</Select>
			</div>

			<div>
				<Label
					htmlFor="task-priority"
					className="text-xs text-muted-foreground mb-1 block"
				>
					Priority
				</Label>
				<Select
					value={task.priority}
					onValueChange={(v) => onUpdate({ priority: v as TaskPriority })}
				>
					<SelectTrigger id="task-priority" className="w-full h-8">
						<div className="flex items-center gap-2">
							<PriorityIcon className="size-4" />
							{priorityLabels[task.priority]}
						</div>
					</SelectTrigger>
					<SelectContent>
						{TASK_PRIORITY.map((p) => {
							const Icon = getPriorityIcon(p);
							return (
								<SelectItem key={p} value={p}>
									<div className="flex items-center gap-2">
										<Icon className="size-4" />
										{priorityLabels[p]}
									</div>
								</SelectItem>
							);
						})}
					</SelectContent>
				</Select>
			</div>

			<div>
				<Label
					htmlFor="task-assignee"
					className="text-xs text-muted-foreground mb-1 block"
				>
					Assignee
				</Label>
				<Select
					value={task.assignee?.id ?? "unassigned"}
					onValueChange={(v) => {
						const user =
							v === "unassigned"
								? null
								: (users.find((u) => u.id === v) ?? null);
						onUpdate({ assignee: user });
					}}
				>
					<SelectTrigger id="task-assignee" className="w-full h-8">
						{task.assignee ? (
							<div className="flex items-center gap-2">
								<Avatar className="size-4">
									<AvatarImage src={task.assignee.avatarUrl} />
									<AvatarFallback className="text-[8px]">
										{getInitials(task.assignee.name)}
									</AvatarFallback>
								</Avatar>
								<span className="text-sm">{task.assignee.name}</span>
							</div>
						) : (
							<span className="text-muted-foreground">Unassigned</span>
						)}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="unassigned">Unassigned</SelectItem>
						{users.map((user) => (
							<SelectItem key={user.id} value={user.id}>
								<div className="flex items-center gap-2">
									<Avatar className="size-4">
										<AvatarImage src={user.avatarUrl} />
										<AvatarFallback className="text-[8px]">
											{getInitials(user.name)}
										</AvatarFallback>
									</Avatar>
									{user.name}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div>
				<span className="text-xs text-muted-foreground mb-1 block">Labels</span>
				<div className="flex flex-wrap gap-1">
					{labels.map((label) => {
						const isSelected = task.labels.some((l) => l.id === label.id);
						return (
							<button
								key={label.id}
								type="button"
								onClick={() => {
									const nextLabels: TaskLabel[] = isSelected
										? task.labels.filter((l) => l.id !== label.id)
										: [...task.labels, label];
									onUpdate({ labels: nextLabels });
								}}
								className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
							>
								<Badge
									className="text-[10px]"
									style={{
										backgroundColor: label.color,
										color: "#fff",
										opacity: isSelected ? 1 : 0.4,
									}}
								>
									{label.name}
								</Badge>
							</button>
						);
					})}
					{labels.length === 0 && (
						<span className="text-sm text-muted-foreground">No labels</span>
					)}
				</div>
			</div>

			<div>
				<span className="text-xs text-muted-foreground mb-1 block">
					Due date
				</span>
				<Popover>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="w-full justify-start"
						>
							{task.dueDate ? formatDate(task.dueDate) : "Set due date"}
						</Button>
					</PopoverTrigger>
					<PopoverContent align="end" className="p-2">
						<div className="flex flex-col gap-2">
							<Calendar
								mode="single"
								selected={task.dueDate ? new Date(task.dueDate) : undefined}
								onSelect={(date) => {
									onUpdate({
										dueDate: date ? date.toISOString().split("T")[0] : null,
									});
								}}
							/>
							<Button
								variant="ghost"
								size="sm"
								className="self-start"
								onClick={() => onUpdate({ dueDate: null })}
							>
								Clear due date
							</Button>
						</div>
					</PopoverContent>
				</Popover>
			</div>

			<Separator />

			<div>
				<span className="text-xs text-muted-foreground mb-1 block">
					Created
				</span>
				<span className="text-sm">{formatDate(task.createdAt)}</span>
			</div>

			<div>
				<span className="text-xs text-muted-foreground mb-1 block">
					Updated
				</span>
				<span className="text-sm">{formatDate(task.updatedAt)}</span>
			</div>
		</div>
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

	const handleUpdate = (updates: Partial<Task>) => {
		updateTask(id, updates);
	};

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
							<div className="prose prose-invert max-w-none text-sm">
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

					<div className="mt-8 pt-4 border-t">
						<h3 className="text-sm font-medium text-muted-foreground mb-4">
							Activity
						</h3>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								<span className="font-medium text-foreground">
									Task created
								</span>{" "}
								on {formatDate(task.createdAt)}
							</li>
							<li>
								<span className="font-medium text-foreground">
									Last updated
								</span>{" "}
								on {formatDate(task.updatedAt)}
							</li>
							{task.assignee && (
								<li>
									Assigned to{" "}
									<span className="font-medium text-foreground">
										{task.assignee.name}
									</span>
								</li>
							)}
							{task.dueDate && (
								<li>
									Due date set to{" "}
									<span className="font-medium text-foreground">
										{formatDate(task.dueDate)}
									</span>
								</li>
							)}
						</ul>
					</div>
				</div>

				<TaskProperties task={task} onUpdate={handleUpdate} />
			</div>
		</div>
	);
}
