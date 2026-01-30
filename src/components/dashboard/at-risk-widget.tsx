import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDataV2 } from "@/data/data-store-v2";
import type { Task } from "@/data/types-new";

export function AtRiskWidget() {
	const users = useDataV2((state) => state.users);
	const tasks = useDataV2((state) => state.tasks);

	const currentUser = users[0];

	const atRiskItems = useMemo(() => {
		if (!currentUser) return [];

		const items: {
			task: Task;
			reason: "overdue" | "due_soon";
			message: string;
		}[] = [];

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		for (const task of tasks) {
			// Only show tasks assigned to current user
			if (task.assignee?.id !== currentUser.id) continue;

			// Skip completed/cancelled tasks
			if (task.status === "done" || task.status === "cancelled") continue;

			// Check overdue
			if (task.dueDate) {
				const dueDate = new Date(task.dueDate);
				if (dueDate < today) {
					items.push({
						task,
						reason: "overdue",
						message: `Overdue by ${Math.ceil(
							(today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
						)} days`,
					});
					continue;
				}

				// Check due soon (within 2 days)
				const twoDaysFromNow = new Date(today);
				twoDaysFromNow.setDate(today.getDate() + 2);
				if (dueDate <= twoDaysFromNow) {
					items.push({
						task,
						reason: "due_soon",
						message: `Due in ${Math.ceil(
							(dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
						)} days`,
					});
				}
			}
		}

		// Sort by severity: overdue first, then due soon
		return items.sort((a, b) => {
			const severity = { overdue: 0, due_soon: 1 };
			return severity[a.reason] - severity[b.reason];
		});
	}, [tasks, currentUser]);

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<AlertTriangle className="size-4 text-muted-foreground" />
					At Risk
				</CardTitle>
			</CardHeader>
			<CardContent>
				{atRiskItems.length === 0 ? (
					<div className="text-sm text-muted-foreground py-4 text-center flex flex-col items-center gap-2">
						<CheckCircle className="size-8 text-green-500" />
						<span>You're all caught up! No at-risk items.</span>
					</div>
				) : (
					<div className="space-y-3">
						{atRiskItems.slice(0, 5).map(({ task, reason, message }) => (
							<Link
								key={task.id}
								to="/tasks/$id"
								params={{ id: task.id }}
								className="flex items-start gap-2 py-2 border-b last:border-0 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
							>
								{reason === "overdue" && (
									<Badge variant="destructive" className="shrink-0 text-[10px]">
										Overdue
									</Badge>
								)}
								{reason === "due_soon" && (
									<Badge variant="outline" className="shrink-0 text-[10px]">
										<Clock className="size-3 mr-1" />
										Soon
									</Badge>
								)}
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium truncate">
										{task.title}
									</div>
									<div className="text-xs text-muted-foreground">{message}</div>
								</div>
							</Link>
						))}
					</div>
				)}

				<Link
					to="/tasks/my"
					className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-4 pt-3 border-t"
				>
					View my tasks
					<ArrowRight className="size-3" />
				</Link>
			</CardContent>
		</Card>
	);
}
