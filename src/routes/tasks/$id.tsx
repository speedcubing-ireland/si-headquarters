import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Plus, Loader2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { CommentsSection } from "@/components/tasks/comments-section";
import { TaskDetails } from "@/components/tasks/task-details";
import { RemindMeDialog } from "@/components/tasks/remind-me-dialog";
import { useTaskColumns } from "@/components/tasks/columns";
import { TasksDataTable } from "@/components/tasks/data-table";
import { TaskListGroup } from "@/components/tasks/task-list-group";
import { TaskModal } from "@/components/tasks/task-modal";
import { TaskLinkedActionsSection } from "@/components/tasks/task-linked-actions";
import { TaskReminderStrip } from "@/components/tasks/task-reminder-strip";
import { DetailSection } from "@/components/shared/detail-page";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requireTaskId } from "@/lib/convex-ids";
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
import type { Task } from "@/data/types-new";
import { onMutationError } from "@/lib/utils";

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

	const [remindMeOpen, setRemindMeOpen] = useState(false);

	const handleToggleSubscription = () => {
		if (isSubscribed) {
			void unsubscribeFromTask(taskId).catch(onMutationError);
			return;
		}
		void subscribeToTask(taskId).catch(onMutationError);
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

	const handleSetReminder = (remindAt: string, message?: string) => {
		void addReminder(
			buildOneTimeReminderPayload(task.id, remindAt, message),
		).catch(onMutationError);
	};

	const handleDelete = async () => {
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
			<main className="min-w-0 flex-1 overflow-x-hidden">
				<div className="h-full overflow-y-auto overflow-x-hidden px-3 pb-4 pt-0 sm:px-4 sm:pb-5 sm:pt-0 lg:px-6 lg:pb-6 lg:pt-0">
					<div className="mx-auto w-full max-w-6xl space-y-6 pb-10 sm:space-y-7 lg:space-y-8">
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
						<TaskDetails
							task={task}
							isSubscribed={isSubscribed}
							onToggleSubscription={handleToggleSubscription}
							onRemindMe={() => setRemindMeOpen(true)}
							onUpdate={(updates) =>
								updateTask(task.id, updates).catch(onMutationError)
							}
							onDelete={handleDelete}
						/>

						<DetailSection title="Linked Integrations">
							<TaskLinkedActionsSection task={task} readOnly={!task.canEdit} />
						</DetailSection>

						<SubTasksList task={task} />

						<DetailSection title="Comments">
							<CommentsSection taskId={task.id} className="mt-0" />
						</DetailSection>
					</div>
				</div>
			</main>
			<RemindMeDialog
				open={remindMeOpen}
				onOpenChange={setRemindMeOpen}
				taskId={task.id}
				onSetReminder={handleSetReminder}
			/>
		</div>
	);
}
