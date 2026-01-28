import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { priorityLabels, statusLabels } from "@/lib/task-constants";
import { getInitials, getPriorityIcon, getStatusIcon } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

interface TaskModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "create" | "edit";
	task?: Task;
	defaultParent?: Task["parent"];
	onSave?: (task: Task) => void;
}

export function TaskModal({
	open,
	onOpenChange,
	mode,
	task,
	defaultParent,
	onSave,
}: TaskModalProps) {
	const users = useDataV2((state) => state.users);
	const teams = useDataV2((state) => state.teams);
	const labels = useDataV2((state) => state.labels);
	const addTask = useDataV2((state) => state.addTask);
	const updateTask = useDataV2((state) => state.updateTask);

	const [title, setTitle] = useState(task?.title ?? "");
	const [description, setDescription] = useState(task?.description ?? "");
	const [status, setStatus] = useState<TaskStatus>(task?.status ?? "to-do");
	const [priority, setPriority] = useState<TaskPriority>(
		task?.priority ?? "medium",
	);
	const [assignee, setAssignee] = useState<User | null>(task?.assignee ?? null);
	const [owner, setOwner] = useState<Team | User | null>(task?.owner ?? null);
	const [selectedLabels, setSelectedLabels] = useState<TaskLabel[]>(
		task?.labels ?? [],
	);
	const [dueDate, setDueDate] = useState<Date | undefined>(
		task?.dueDate ? new Date(task.dueDate) : undefined,
	);
	const [parent] = useState<Task["parent"]>(
		task?.parent ?? defaultParent ?? null,
	);

	React.useEffect(() => {
		if (open && mode === "create") {
			setTitle("");
			setDescription("");
			setStatus("to-do");
			setPriority("medium");
			setAssignee(null);
			setOwner(null);
			setSelectedLabels([]);
			setDueDate(undefined);
		} else if (open && mode === "edit" && task) {
			setTitle(task.title);
			setDescription(task.description);
			setStatus(task.status);
			setPriority(task.priority);
			setAssignee(task.assignee);
			setOwner(task.owner);
			setSelectedLabels(task.labels);
			setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
		}
	}, [open, mode, task]);

	const handleSubmit = () => {
		if (!title.trim()) return;

		if (mode === "create") {
			const newTask = addTask({
				parent,
				title: title.trim(),
				description,
				owner,
				assignee,
				phase: null,
				status,
				priority,
				dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
				requiredApprovalBy: [],
				approvedBy: [],
				labels: selectedLabels,
				resources: [],
			});
			onSave?.(newTask);
		} else if (task) {
			updateTask(task.id, {
				title: title.trim(),
				description,
				status,
				priority,
				assignee,
				owner,
				labels: selectedLabels,
				dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
			});
			onSave?.(task);
		}

		onOpenChange(false);
	};

	const toggleLabel = (label: TaskLabel) => {
		const hasLabel = selectedLabels.some((l) => l.id === label.id);
		if (hasLabel) {
			setSelectedLabels(selectedLabels.filter((l) => l.id !== label.id));
		} else {
			setSelectedLabels([...selectedLabels, label]);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px] p-0">
				<DialogHeader className="px-6 pt-6 pb-4 border-b">
					<DialogTitle>
						{mode === "create" ? "Create Task" : "Edit Task"}
					</DialogTitle>
				</DialogHeader>

				<div className="px-6 py-4 space-y-4">
					<Input
						placeholder="Describe the task..."
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className="text-lg font-medium border-0 px-0 focus-visible:ring-0 placeholder:text-muted-foreground"
						autoFocus
					/>

					<Textarea
						placeholder="Add description... (Markdown supported)"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className="min-h-[100px] resize-none border-0 px-0 focus-visible:ring-0 placeholder:text-muted-foreground"
					/>
					<p className="text-xs text-muted-foreground">
						You can use basic Markdown for formatting (lists, **bold**, links).
					</p>
				</div>

				<div className="px-6 py-4 border-t flex flex-wrap items-center gap-2">
					<Select
						value={status}
						onValueChange={(v) => setStatus(v as TaskStatus)}
					>
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
							if (v === "unassigned") {
								setAssignee(null);
							} else {
								const user = users.find((u) => u.id === v);
								setAssignee(user ?? null);
							}
						}}
					>
						<SelectTrigger className="w-auto h-8 gap-1">
							<SelectValue placeholder="Assignee" />
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
								const id = v.slice("team:".length);
								const team = teams.find((t) => t.id === id) ?? null;
								setOwner(team);
								return;
							}
							if (v.startsWith("user:")) {
								const id = v.slice("user:".length);
								const user = users.find((u) => u.id === id) ?? null;
								setOwner(user);
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

					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm" className="h-8">
								Labels
								{selectedLabels.length > 0 && (
									<Badge variant="secondary" className="ml-1">
										{selectedLabels.length}
									</Badge>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-48 p-2" align="start">
							<div className="space-y-1">
								{labels.map((label) => {
									const isSelected = selectedLabels.some(
										(l) => l.id === label.id,
									);
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

				{selectedLabels.length > 0 && (
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
				)}

				<div className="px-6 py-4 border-t flex justify-end gap-2">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={!title.trim()}>
						{mode === "create" ? "Create Task" : "Save Changes"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
