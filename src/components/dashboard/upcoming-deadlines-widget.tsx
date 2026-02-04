import { useMemo } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, AlertCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTasks, useUsers } from "@/hooks/use-convex-data";
import { formatDateShort } from "@/lib/format-utils";

export function UpcomingDeadlinesWidget() {
	const { users } = useUsers();
	const { tasks } = useTasks(false);

	const currentUser = users[0];

	const upcomingDeadlines = useMemo(() => {
		if (!currentUser) return [];

		const today = new Date();
		const sevenDaysFromNow = new Date();
		sevenDaysFromNow.setDate(today.getDate() + 7);

		return tasks
			.filter(
				(task) =>
					task.assignee?.id === currentUser.id &&
					task.dueDate &&
					task.status !== "done" &&
					task.status !== "cancelled" &&
					new Date(task.dueDate) >= today &&
					new Date(task.dueDate) <= sevenDaysFromNow,
			)
			.sort(
				(a, b) =>
					new Date(a.dueDate as string).getTime() -
					new Date(b.dueDate as string).getTime(),
			)
			.slice(0, 5);
	}, [tasks, currentUser]);

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Clock className="size-4 text-muted-foreground" />
					Upcoming Deadlines
				</CardTitle>
			</CardHeader>
			<CardContent>
				{upcomingDeadlines.length === 0 ? (
					<div className="text-sm text-muted-foreground py-4 text-center">
						No upcoming deadlines in the next 7 days
					</div>
				) : (
					<div className="space-y-3">
						{upcomingDeadlines.map((task) => {
							const dueDate = new Date(task.dueDate as string);
							const today = new Date();
							const daysUntil = Math.ceil(
								(dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
							);

							let urgencyBadge: ReactNode;
							if (daysUntil <= 1) {
								urgencyBadge = (
									<Badge variant="destructive" className="text-[10px]">
										<AlertCircle className="size-3 mr-1" />
										{daysUntil === 0 ? "Today" : "Tomorrow"}
									</Badge>
								);
							} else if (daysUntil <= 3) {
								urgencyBadge = (
									<Badge
										variant="outline"
										className="text-[10px] border-orange-500 text-orange-500"
									>
										{daysUntil} days
									</Badge>
								);
							} else {
								urgencyBadge = (
									<Badge variant="outline" className="text-[10px]">
										{daysUntil} days
									</Badge>
								);
							}

							return (
								<Link
									key={task.id}
									to="/tasks/$id"
									params={{ id: task.id }}
									className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
								>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="text-xs text-muted-foreground font-mono">
												{task.identifier}
											</span>
											<span className="text-sm font-medium truncate">
												{task.title}
											</span>
										</div>
										<div className="text-xs text-muted-foreground mt-0.5">
											Due {formatDateShort(task.dueDate as string)}
										</div>
									</div>
									{urgencyBadge}
								</Link>
							);
						})}
					</div>
				)}

				<Link
					to="/tasks/my"
					className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-4 pt-3 border-t"
				>
					View all my tasks
					<ArrowRight className="size-3" />
				</Link>
			</CardContent>
		</Card>
	);
}
