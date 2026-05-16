import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Link2, Plus, Trash2 } from "lucide-react";
import { DetailSection } from "@/components/shared/detail-page";
import { AddBlockingTaskDialog } from "@/components/tasks/task-dialogs";
import { Button } from "@/components/ui/button";
import type { Task } from "@/data/types-new";
import { useTaskMutations } from "@/hooks/use-convex-data";
import { onMutationError } from "@/lib/utils";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function TaskDependenciesPanel({ task }: { task: Task }) {
	const { addBlockingRelation, removeBlockingRelation } = useTaskMutations();
	const [isBlockingDialogOpen, setIsBlockingDialogOpen] = useState(false);

	const handleAddBlockingTask = (blockingTaskId: Task["id"]) => {
		void addBlockingRelation(task.id, blockingTaskId).catch(onMutationError);
	};

	const handleRemoveBlockingTask = (blockingTaskId: Task["id"]) => {
		void removeBlockingRelation(task.id, blockingTaskId).catch(onMutationError);
	};

	const handleRemoveBlockedTask = (blockedTaskId: Task["id"]) => {
		void removeBlockingRelation(blockedTaskId, task.id).catch(onMutationError);
	};

	return (
		<>
			<DetailSection title="Dependencies">
				<div className="space-y-4">
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Blocked by
							</div>
							{task.isBlocked ? (
								<span className="text-xs font-medium text-warning-foreground">
									{task.unresolvedBlockerCount} active
								</span>
							) : null}
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
												className="block font-medium leading-snug [overflow-wrap:anywhere] hover:underline underline-offset-2"
											>
												{relation.task.identifier} {relation.task.title}
											</Link>
											<div
												className={cn(
													"text-xs",
													relation.isResolved ? "text-success" : "text-warning",
												)}
											>
												{relation.isResolved ? "Resolved" : "Blocking"}
											</div>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 shrink-0"
											onClick={() => handleRemoveBlockingTask(relation.task.id)}
											title="Remove blocker"
										>
											<Trash2 className="size-3.5 text-muted-foreground" />
										</Button>
									</div>
								))}
							</div>
						)}
					</div>

					<Button
						variant="ghost"
						size="sm"
						className="justify-start text-muted-foreground hover:text-foreground"
						onClick={() => setIsBlockingDialogOpen(true)}
					>
						<Plus className="mr-1.5 size-3.5" />
						Add blocker
					</Button>

					<div className="space-y-2">
						<div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
												className="block font-medium leading-snug [overflow-wrap:anywhere] hover:underline underline-offset-2"
											>
												{blockedTask.identifier} {blockedTask.title}
											</Link>
											<div className="text-xs text-muted-foreground">
												Status: {blockedTask.status}
											</div>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 shrink-0"
											onClick={() => handleRemoveBlockedTask(blockedTask.id)}
											title="Remove dependency"
										>
											<Trash2 className="size-3.5 text-muted-foreground" />
										</Button>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</DetailSection>

			<AddBlockingTaskDialog
				open={isBlockingDialogOpen}
				onOpenChange={setIsBlockingDialogOpen}
				task={task}
				onAddBlockingTask={handleAddBlockingTask}
			/>
		</>
	);
}
