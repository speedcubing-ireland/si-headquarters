import { useMemo } from "react";
import { useQuery } from "convex/react";
import { AlertTriangle, Bell, CheckCircle2, Clock, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useTasks, useUnreadCount } from "@/hooks/use-convex-data";
import { isUserRequiredApprover } from "@/lib/task-utils";

interface AttentionCounts {
	overdue: number;
	needsReview: number;
	dueSoon: number;
	unread: number;
}

function useAttentionCounts(): AttentionCounts & { isLoading: boolean } {
	const { tasks, isLoading: tasksLoading } = useTasks(false);
	const currentUser = useQuery(api.users.getCurrentUser);
	const unreadCount = useUnreadCount();
	const userId = currentUser?._id;

	const counts = useMemo(() => {
		if (!userId) return { overdue: 0, needsReview: 0, dueSoon: 0 };

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const threeDays = new Date(today);
		threeDays.setDate(today.getDate() + 3);

		let overdue = 0;
		let needsReview = 0;
		let dueSoon = 0;

		for (const task of tasks) {
			const isDone = task.status === "done" || task.status === "cancelled";
			if (isDone) continue;

			// Needs review: I'm a required approver and haven't approved
			if (
				task.status === "awaiting-review" &&
				isUserRequiredApprover(task, userId) &&
				!task.approvedBy.some((u) => u.id === userId)
			) {
				needsReview++;
			}

			// Only count assignment-based badges for tasks assigned to me
			if (task.assignee?.id !== userId) continue;
			if (!task.dueDate) continue;

			const dueDate = new Date(task.dueDate);
			if (dueDate < today) {
				overdue++;
			} else if (dueDate < threeDays) {
				dueSoon++;
			}
		}

		return { overdue, needsReview, dueSoon };
	}, [tasks, userId]);

	return {
		...counts,
		unread: unreadCount ?? 0,
		isLoading: tasksLoading || currentUser === undefined,
	};
}

export function AttentionBar() {
	const { overdue, needsReview, dueSoon, unread, isLoading } =
		useAttentionCounts();

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-2.5">
				<div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
				<div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
			</div>
		);
	}

	const hasAny = overdue > 0 || needsReview > 0 || dueSoon > 0 || unread > 0;

	if (!hasAny) {
		return (
			<div className="flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-2.5">
				<CheckCircle2 className="size-4 text-green-500" />
				<span className="text-sm text-muted-foreground">All clear</span>
			</div>
		);
	}

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-4 py-2.5">
			{overdue > 0 && (
				<Badge variant="destructive" className="gap-1.5">
					<AlertTriangle className="size-3" />
					{overdue} Overdue
				</Badge>
			)}
			{needsReview > 0 && (
				<Badge
					variant="outline"
					className="gap-1.5 border-orange-500/50 text-orange-600 dark:text-orange-400"
				>
					<Eye className="size-3" />
					{needsReview} Need Review
				</Badge>
			)}
			{dueSoon > 0 && (
				<Badge variant="outline" className="gap-1.5">
					<Clock className="size-3" />
					{dueSoon} Due Soon
				</Badge>
			)}
			{unread > 0 && (
				<Badge variant="secondary" className="gap-1.5">
					<Bell className="size-3" />
					{unread} Unread
				</Badge>
			)}
			<span className="basis-full text-xs text-muted-foreground sm:basis-auto sm:ml-auto">
				Review tasks in the My Focus panel below.
			</span>
		</div>
	);
}
