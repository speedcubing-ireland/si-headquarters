import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import React from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	useUsers,
	useTeams,
	useLabels,
	useTaskMutations,
} from "@/hooks/use-convex-data";
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
	statusLabels,
	DEFAULT_TASK_STATUS,
	DEFAULT_TASK_PRIORITY,
} from "@/lib/task-constants";
import { getPriorityIcon, getStatusIcon } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

interface TaskModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "create" | "edit";
	task?: Task;
	defaultParent?: Task["parent"];
	onSave?: (task: Task) => void;
}

function useTaskModalFormState(
	open: boolean,
	mode: "create" | "edit",
	task: Task | undefined,
	defaultParent: Task["parent"] | undefined,
) {
	// Derive initial values during render instead of syncing in useEffect
	const initialValues = useMemo(() => {
		if (!open) return null;
		if (mode === "create") {
			return {
				title: "",
				description: "",
				status: DEFAULT_TASK_STATUS,
				priority: DEFAULT_TASK_PRIORITY,
				assignee: null as User | null,
				owner: null as Team | User | null,
				selectedLabels: [] as TaskLabel[],
				dueDate: undefined as Date | undefined,
				parent: (defaultParent ?? null) as Task["parent"],
			};
		}
		if (mode === "edit" && task) {
			return {
				title: task.title,
				description: task.description,
				status: task.status,
				priority: task.priority,
				assignee: task.assignee,
				owner: task.owner,
				selectedLabels: task.labels,
				dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
				parent: task.parent ?? defaultParent ?? null,
			};
		}
		return null;
	}, [open, mode, task, defaultParent]);

	const [title, setTitle] = useState(initialValues?.title ?? "");
	const [description, setDescription] = useState(
		initialValues?.description ?? "",
	);
	const [status, setStatus] = useState<TaskStatus>(
		initialValues?.status ?? "to-do",
	);
	const [priority, setPriority] = useState<TaskPriority>(
		initialValues?.priority ?? "medium",
	);
	const [assignee, setAssignee] = useState<User | null>(
		initialValues?.assignee ?? null,
	);
	const [owner, setOwner] = useState<Team | User | null>(
		initialValues?.owner ?? null,
	);
	const [selectedLabels, setSelectedLabels] = useState<TaskLabel[]>(
		initialValues?.selectedLabels ?? [],
	);
	const [dueDate, setDueDate] = useState<Date | undefined>(
		initialValues?.dueDate,
	);
	const [parent] = useState<Task["parent"]>(initialValues?.parent ?? null);

	// Track previous initialValues to only update when they actually change
	const prevInitialValuesRef = useRef(initialValues);
	useEffect(() => {
		if (initialValues && prevInitialValuesRef.current !== initialValues) {
			setTitle(initialValues.title);
			setDescription(initialValues.description);
			setStatus(initialValues.status);
			setPriority(initialValues.priority);
			setAssignee(initialValues.assignee);
			setOwner(initialValues.owner);
			setSelectedLabels(initialValues.selectedLabels);
			setDueDate(initialValues.dueDate);
			prevInitialValuesRef.current = initialValues;
		}
	}, [initialValues]);

	return useMemo(
		() => ({
			title,
			setTitle,
			description,
			setDescription,
			status,
			setStatus,
			priority,
			setPriority,
			assignee,
			setAssignee,
			owner,
			setOwner,
			selectedLabels,
			setSelectedLabels,
			dueDate,
			setDueDate,
			parent,
		}),
		[
			title,
			description,
			status,
			priority,
			assignee,
			owner,
			selectedLabels,
			dueDate,
			parent,
		],
	);
}

const TaskModalFormFields = React.memo(function TaskModalFormFields({
	title,
	setTitle,
	description,
	setDescription,
}: {
	title: string;
	description: string;
	setTitle: (v: string) => void;
	setDescription: (v: string) => void;
}) {
	return (
		<div className="px-6 py-4 space-y-4">
			<Input
				placeholder="Describe the task..."
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				className="text-lg font-medium border-0 px-0 focus-visible:ring-0 placeholder:text-muted-foreground"
				autoFocus
			/>
			<Textarea
				placeholder="Add description..."
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				className="min-h-[100px] resize-none border-0 px-0 focus-visible:ring-0 placeholder:text-muted-foreground"
			/>
		</div>
	);
});

const TaskModalPropertyBar = React.memo(function TaskModalPropertyBar({
	status,
	setStatus,
	priority,
	setPriority,
	assignee,
	setAssignee,
	owner,
	setOwner,
	selectedLabels,
	dueDate,
	setDueDate,
	users,
	teams,
	labels,
	toggleLabel,
}: {
	status: TaskStatus;
	setStatus: (v: TaskStatus) => void;
	priority: TaskPriority;
	setPriority: (v: TaskPriority) => void;
	assignee: User | null;
	setAssignee: (u: User | null) => void;
	owner: Team | User | null;
	setOwner: (o: Team | User | null) => void;
	selectedLabels: TaskLabel[];
	dueDate: Date | undefined;
	setDueDate: (d: Date | undefined) => void;
	users: User[];
	teams: Team[];
	labels: TaskLabel[];
	toggleLabel: (label: TaskLabel) => void;
}) {
	return (
		<div className="px-6 py-4 border-t flex flex-wrap items-center gap-2">
			<Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
				<SelectTrigger className="w-auto h-8 gap-1">
					<SelectValue />
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

			<Select
				value={priority}
				onValueChange={(v) => setPriority(v as TaskPriority)}
			>
				<SelectTrigger className="w-auto h-8 gap-1">
					<SelectValue />
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

			<Select
				value={assignee?.id ?? "unassigned"}
				onValueChange={(v) => {
					if (v === "unassigned") setAssignee(null);
					else setAssignee(users.find((u) => u.id === v) ?? null);
				}}
			>
				<SelectTrigger className="w-auto h-8 gap-1">
					<SelectValue placeholder="Assignee" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="unassigned">Unassigned</SelectItem>
					{users.map((user) => (
						<SelectItem key={user.id} value={user.id}>
							<UserAvatar
								user={user}
								size="xs"
								showName
								nameClassName="text-sm"
							/>
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Select
				value={
					owner
						? "members" in owner
							? `team:${owner.id}`
							: `user:${owner.id}`
						: "unassigned"
				}
				onValueChange={(v) => {
					if (v === "unassigned") {
						setOwner(null);
						return;
					}
					if (v.startsWith("team:")) {
						setOwner(
							teams.find((t) => t.id === v.slice("team:".length)) ?? null,
						);
						return;
					}
					if (v.startsWith("user:")) {
						setOwner(
							users.find((u) => u.id === v.slice("user:".length)) ?? null,
						);
					}
				}}
			>
				<SelectTrigger className="w-auto h-8 gap-1">
					<SelectValue placeholder="Owner" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="unassigned">Owner: Unassigned</SelectItem>
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
									<UserAvatar
										user={user}
										size="xs"
										showName
										nameClassName="text-sm"
									/>
								</SelectItem>
							))}
						</>
					)}
				</SelectContent>
			</Select>

			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="h-8">
						Labels
						{selectedLabels.length > 0 ? (
							<Badge variant="secondary" className="ml-1">
								{selectedLabels.length}
							</Badge>
						) : null}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-48 p-2" align="start">
					<div className="space-y-1">
						{labels.map((label) => {
							const isSelected = selectedLabels.some((l) => l.id === label.id);
							return (
								<Button
									key={label.id}
									variant={isSelected ? "secondary" : "ghost"}
									size="sm"
									className="w-full justify-start gap-2"
									onClick={() => toggleLabel(label)}
								>
									<div
										className="size-3 rounded-full"
										style={{ backgroundColor: label.color }}
									/>
									{label.name}
								</Button>
							);
						})}
					</div>
				</PopoverContent>
			</Popover>

			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className={cn("h-8 gap-1", !dueDate && "text-muted-foreground")}
					>
						<CalendarIcon className="size-4" />
						{dueDate ? format(dueDate, "MMM d, yyyy") : "Due date"}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						mode="single"
						selected={dueDate}
						onSelect={setDueDate}
						initialFocus
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
});

const TaskModalLabelsChips = React.memo(function TaskModalLabelsChips({
	selectedLabels,
	toggleLabel,
}: {
	selectedLabels: TaskLabel[];
	toggleLabel: (label: TaskLabel) => void;
}) {
	if (selectedLabels.length === 0) return null;
	return (
		<div className="px-6 pb-2 flex flex-wrap gap-1">
			{selectedLabels.map((label) => (
				<Badge
					key={label.id}
					className="gap-1 cursor-pointer"
					style={{ backgroundColor: label.color, color: "#fff" }}
					onClick={() => toggleLabel(label)}
				>
					{label.name}
					<X className="size-3" />
				</Badge>
			))}
		</div>
	);
});

const TaskModalFooter = React.memo(function TaskModalFooter({
	mode,
	onClose,
	onSubmit,
	submitDisabled,
}: {
	mode: "create" | "edit";
	onClose: () => void;
	onSubmit: () => void;
	submitDisabled: boolean;
}) {
	return (
		<div className="px-6 py-4 border-t flex justify-end gap-2">
			<Button variant="outline" onClick={onClose}>
				Cancel
			</Button>
			<Button onClick={onSubmit} disabled={submitDisabled}>
				{mode === "create" ? "Create Task" : "Save Changes"}
			</Button>
		</div>
	);
});

export function TaskModal({
	open,
	onOpenChange,
	mode,
	task,
	defaultParent,
	onSave,
}: TaskModalProps) {
	const { users } = useUsers();
	const { teams } = useTeams();
	const { labels } = useLabels();
	const { addTask, updateTask } = useTaskMutations();

	const form = useTaskModalFormState(open, mode, task, defaultParent);

	const toggleLabel = useCallback(
		(label: TaskLabel) => {
			form.setSelectedLabels((prev) => {
				const hasLabel = prev.some((l) => l.id === label.id);
				if (hasLabel) return prev.filter((l) => l.id !== label.id);
				return [...prev, label];
			});
		},
		[form],
	);

	const handleSubmit = useCallback(async () => {
		if (!form.title.trim()) return;

		if (mode === "create") {
			const newTask = await addTask({
				parent: form.parent,
				title: form.title.trim(),
				description: form.description,
				owner: form.owner,
				assignee: form.assignee,
				phase: null,
				status: form.status,
				priority: form.priority,
				dueDate: form.dueDate ? format(form.dueDate, "yyyy-MM-dd") : null,
				labels: form.selectedLabels,
				resources: [],
			});
			onSave?.(newTask);
		} else if (task) {
			await updateTask(task.id, {
				title: form.title.trim(),
				description: form.description,
				status: form.status,
				priority: form.priority,
				assignee: form.assignee,
				owner: form.owner,
				labels: form.selectedLabels,
				dueDate: form.dueDate ? format(form.dueDate, "yyyy-MM-dd") : null,
			});
			onSave?.(task);
		}

		onOpenChange(false);
	}, [mode, task, form, addTask, updateTask, onSave, onOpenChange]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px] p-0">
				<DialogHeader className="px-6 pt-6 pb-4 border-b">
					<DialogTitle>
						{mode === "create" ? "Create Task" : "Edit Task"}
					</DialogTitle>
				</DialogHeader>

				<TaskModalFormFields
					title={form.title}
					setTitle={form.setTitle}
					description={form.description}
					setDescription={form.setDescription}
				/>

				<TaskModalPropertyBar
					status={form.status}
					setStatus={form.setStatus}
					priority={form.priority}
					setPriority={form.setPriority}
					assignee={form.assignee}
					setAssignee={form.setAssignee}
					owner={form.owner}
					setOwner={form.setOwner}
					selectedLabels={form.selectedLabels}
					dueDate={form.dueDate}
					setDueDate={form.setDueDate}
					users={users}
					teams={teams}
					labels={labels}
					toggleLabel={toggleLabel}
				/>

				<TaskModalLabelsChips
					selectedLabels={form.selectedLabels}
					toggleLabel={toggleLabel}
				/>

				<TaskModalFooter
					mode={mode}
					onClose={useCallback(() => onOpenChange(false), [onOpenChange])}
					onSubmit={handleSubmit}
					submitDisabled={!form.title.trim()}
				/>
			</DialogContent>
		</Dialog>
	);
}
