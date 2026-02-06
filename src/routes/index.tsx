import { createFileRoute, Link } from "@tanstack/react-router";
import { ListTodo, Trophy, Bell, ArrowRight } from "lucide-react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	useTasks,
	useCompetitions,
	useUnreadCount,
} from "@/hooks/use-convex-data";
import { ActiveCompetitionsWidget } from "@/components/dashboard/active-competitions-widget";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/upcoming-deadlines-widget";
import { TaskPriorityChart } from "@/components/dashboard/task-priority-chart";
import { AtRiskWidget } from "@/components/dashboard/at-risk-widget";
import { RecentActivityWidget } from "@/components/dashboard/recent-activity-widget";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const { tasks } = useTasks(false);
	const { competitions } = useCompetitions();
	const unreadCount = useUnreadCount();

	const openTasks = tasks.filter((task) => task.status !== "done").length;

	const upcomingCompetitions = competitions.filter((competition) => {
		const today = new Date().toISOString().split("T")[0];
		return competition.compStart >= today;
	}).length;

	const unreadNotifications = unreadCount ?? 0;

	return (
		<>
			<header className="flex h-16 shrink-0 items-center gap-2">
				<div className="flex items-center gap-2 px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mr-2 data-[orientation=vertical]:h-4"
					/>
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbPage>Headquarters</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
			</header>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<div className="grid auto-rows-min gap-4 md:grid-cols-3">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium flex items-center gap-2">
								<ListTodo className="size-4 text-muted-foreground" />
								Open Tasks
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold">{openTasks}</div>
							<Link
								to="/tasks"
								className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2"
							>
								View all tasks
								<ArrowRight className="size-3" />
							</Link>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium flex items-center gap-2">
								<Trophy className="size-4 text-muted-foreground" />
								Upcoming Competitions
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold">{upcomingCompetitions}</div>
							<Link
								to="/competitions"
								className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2"
							>
								View all competitions
								<ArrowRight className="size-3" />
							</Link>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium flex items-center gap-2">
								<Bell className="size-4 text-muted-foreground" />
								Unread Notifications
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold">{unreadNotifications}</div>
							<Link
								to="/inbox"
								className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2"
							>
								Go to inbox
								<ArrowRight className="size-3" />
							</Link>
						</CardContent>
					</Card>
				</div>

				<div className="grid auto-rows-min gap-4 md:grid-cols-2">
					<ActiveCompetitionsWidget />
					<UpcomingDeadlinesWidget />
					<TaskPriorityChart />
					<AtRiskWidget />
				</div>

				<RecentActivityWidget />
			</div>
		</>
	);
}
