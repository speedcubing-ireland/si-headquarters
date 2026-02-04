import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTasks } from "@/hooks/use-convex-data";

const PRIORITY_COLORS = {
	low: "#6b7280",
	medium: "#eab308",
	high: "#f97316",
	urgent: "#ef4444",
};

export function TaskPriorityChart() {
	const { tasks } = useTasks(false);

	const data = useMemo(() => {
		const counts: Record<string, number> = {
			low: 0,
			medium: 0,
			high: 0,
			urgent: 0,
		};

		for (const task of tasks) {
			if (task.status !== "done" && task.status !== "cancelled") {
				counts[task.priority]++;
			}
		}

		return Object.entries(counts)
			.filter(([, count]) => count > 0)
			.map(([priority, count]) => ({
				name: priority.charAt(0).toUpperCase() + priority.slice(1),
				value: count,
				color: PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS],
			}));
	}, [tasks]);

	const total = data.reduce((sum, item) => sum + item.value, 0);

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium">
					Task Priority Distribution
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="h-48">
					{total > 0 ? (
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={data}
									cx="50%"
									cy="50%"
									innerRadius={40}
									outerRadius={70}
									paddingAngle={2}
									dataKey="value"
								>
									{data.map((entry) => (
										<Cell key={entry.name} fill={entry.color} />
									))}
								</Pie>
								<Tooltip
									contentStyle={{
										backgroundColor: "hsl(var(--popover))",
										border: "1px solid hsl(var(--border))",
										borderRadius: "6px",
									}}
									itemStyle={{ color: "hsl(var(--foreground))" }}
								/>
							</PieChart>
						</ResponsiveContainer>
					) : (
						<div className="h-full flex items-center justify-center text-sm text-muted-foreground">
							No active tasks
						</div>
					)}
				</div>

				<div className="flex flex-wrap gap-3 mt-2 justify-center">
					{data.map((item) => (
						<div key={item.name} className="flex items-center gap-1.5 text-xs">
							<div
								className="size-2.5 rounded-full"
								style={{ backgroundColor: item.color }}
							/>
							<span className="text-muted-foreground">{item.name}</span>
							<span className="font-medium">{item.value}</span>
						</div>
					))}
				</div>

				<Link
					to="/tasks"
					className="block text-center text-xs text-muted-foreground hover:text-foreground mt-4 pt-3 border-t"
				>
					View all tasks
				</Link>
			</CardContent>
		</Card>
	);
}
