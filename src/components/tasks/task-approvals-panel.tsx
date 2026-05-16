import { useQuery } from "convex/react";
import {
	Check,
	CheckCircle2,
	Clock,
	Plus,
	Shield,
	Trash2,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { DetailSection } from "@/components/shared/detail-page";
import { AddApproverDialog } from "@/components/tasks/task-dialogs";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Task, Team, User } from "@/data/types-new";
import { useTaskMutations } from "@/hooks/use-convex-data";
import { useIsDirector } from "@/hooks/convex/use-admin";
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";
import { cn, onMutationError } from "@/lib/utils";

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
				"group flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm",
				isApproved
					? "border-success/30 bg-success/10"
					: "border-muted bg-muted/50",
			)}
		>
			<div
				className={cn(
					"flex h-5 w-5 items-center justify-center rounded-full",
					isApproved ? "text-success" : "bg-muted-foreground/20",
				)}
			>
				{isApproved ? (
					<Check className="size-3" />
				) : (
					<Clock className="size-3 text-muted-foreground" />
				)}
			</div>
			<div className="min-w-0 flex-1">
				<div className="truncate font-medium">{approver.name}</div>
				<div
					className={cn(
						"text-xs",
						isApproved ? "text-success" : "text-muted-foreground",
					)}
				>
					{isTeam ? "Team" : isCurrentUser ? "You" : "User"} -{" "}
					{isApproved ? "Approved" : "Pending"}
				</div>
			</div>
			<div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
				{canToggleApproval ? (
					isApproved ? (
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
					)
				) : null}
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

export function TaskApprovalsPanel({ task }: { task: Task }) {
	const {
		addRequiredApprover,
		removeRequiredApprover,
		approveTask,
		unapproveTask,
	} = useTaskMutations();
	const currentUserResult = useQuery(api.core.users.getCurrentUser);
	const { data: currentUser } = useRetainedQueryResult(currentUserResult);
	const { isDirector } = useIsDirector();
	const [isApproverDialogOpen, setIsApproverDialogOpen] = useState(false);

	const approvedUserIds = new Set(
		task.approvedBy.map((approver) => approver.id),
	);
	const isApproved = (approver: Team | User): boolean => {
		if ("members" in approver) {
			return approver.members.some((member) => approvedUserIds.has(member.id));
		}
		return approvedUserIds.has(approver.id);
	};

	const approvalStatus = {
		required: task.requiredApprovalBy,
		approvedCount: task.requiredApprovalBy.filter(isApproved).length,
		requiredCount: task.requiredApprovalBy.length,
		isFullyApproved:
			task.requiredApprovalBy.length > 0 &&
			task.requiredApprovalBy.every(isApproved),
		pending: task.requiredApprovalBy.filter(
			(approver) => !isApproved(approver),
		),
	};

	const isCurrentUserApprover = (approver: Team | User) => {
		if ("members" in approver) {
			return approver.members.some((member) => member.id === currentUser?._id);
		}
		return approver.id === currentUser?._id;
	};

	const handleAddApprover = (approver: Team | User) => {
		void addRequiredApprover(task.id, approver).catch(onMutationError);
	};

	const handleRemoveApprover = (approverId: string) => {
		const approver = task.requiredApprovalBy.find(
			(item) => item.id === approverId,
		);
		if (!approver) return;
		const approverKey =
			"members" in approver ? `team:${approverId}` : `user:${approverId}`;
		void removeRequiredApprover(task.id, approverKey).catch(onMutationError);
	};

	return (
		<>
			<DetailSection title="Approvals">
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<Shield className="size-3.5" />
							Required approvers
						</div>
						{approvalStatus.requiredCount > 0 ? (
							<span
								className={cn(
									"text-xs font-medium",
									approvalStatus.isFullyApproved
										? "text-success-foreground"
										: "text-warning-foreground",
								)}
							>
								{approvalStatus.approvedCount}/{approvalStatus.requiredCount}
							</span>
						) : null}
					</div>

					{approvalStatus.requiredCount === 0 ? (
						<div className="text-sm text-muted-foreground">
							No approvals required
						</div>
					) : (
						<div className="flex flex-col gap-1.5">
							{approvalStatus.required.map((approver) => (
								<ApprovalBadge
									key={approver.id}
									approver={approver}
									isApproved={isApproved(approver)}
									canToggleApproval={
										isDirector || isCurrentUserApprover(approver)
									}
									isCurrentUser={isCurrentUserApprover(approver)}
									onRemove={() => handleRemoveApprover(approver.id)}
									onApprove={() => {
										void approveTask(task.id).catch(onMutationError);
									}}
									onUnapprove={() => {
										void unapproveTask(task.id).catch(onMutationError);
									}}
								/>
							))}
						</div>
					)}

					<Button
						variant="ghost"
						size="sm"
						className="justify-start text-muted-foreground hover:text-foreground"
						onClick={() => setIsApproverDialogOpen(true)}
					>
						<Plus className="mr-1.5 size-3.5" />
						Add approver
					</Button>

					{task.status === "done" &&
					approvalStatus.requiredCount > 0 &&
					!approvalStatus.isFullyApproved ? (
						<div className="rounded-md border border-warning/20 bg-warning/10 p-2 text-xs text-warning-foreground">
							Task is marked done but missing required approvals (
							{approvalStatus.pending.length} pending)
						</div>
					) : null}
				</div>
			</DetailSection>

			<AddApproverDialog
				open={isApproverDialogOpen}
				onOpenChange={setIsApproverDialogOpen}
				task={task}
				onAdd={handleAddApprover}
			/>
		</>
	);
}
