import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleCheck, Inbox, ListTodo, Trophy } from "lucide-react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDataV2 } from "@/data/data-store-v2";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const tasks = useDataV2((state) => state.tasks);
	const competitions = useDataV2((state) => state.competitions);

	const openTasks = tasks.filter((task) => task.status !== "done").length;
	const upcomingCompetitions = competitions.filter((competition) => {
		const today = new Date().toISOString().split("T")[0];
		return competition.compStart >= today;
	}).length;

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
						<CardHeader>
							<CardTitle>Get started</CardTitle>
							<CardDescription>
								Core views for planning and running competitions.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-2">
							<Button asChild variant="outline" className="justify-start gap-2">
								<Link to="/tasks">
									<ListTodo className="size-4" />
									All tasks
								</Link>
							</Button>
							<Button asChild variant="outline" className="justify-start gap-2">
								<Link to="/tasks/my">
									<CircleCheck className="size-4" />
									My tasks
								</Link>
							</Button>
							<Button asChild variant="outline" className="justify-start gap-2">
								<Link to="/inbox">
									<Inbox className="size-4" />
									Inbox
								</Link>
							</Button>
							<Button asChild variant="outline" className="justify-start gap-2">
								<Link to="/competitions">
									<Trophy className="size-4" />
									Competitions
								</Link>
							</Button>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>At a glance</CardTitle>
							<CardDescription>
								Today&apos;s workload and upcoming events.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid grid-cols-2 gap-4">
							<div>
								<div className="text-sm text-muted-foreground">Open tasks</div>
								<div className="text-2xl font-semibold">{openTasks}</div>
							</div>
							<div>
								<div className="text-sm text-muted-foreground">
									Upcoming competitions
								</div>
								<div className="text-2xl font-semibold">
									{upcomingCompetitions}
								</div>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Shortcuts</CardTitle>
							<CardDescription>
								A few power moves for navigating Headquarters.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2 text-sm text-muted-foreground">
							<p>
								<span className="font-mono text-xs border rounded px-1 py-0.5 mr-1">
									C
								</span>
								Create a new task from the current tasks view.
							</p>
							<p>
								Use the sidebar to jump between tasks, inbox, and competitions.
							</p>
						</CardContent>
					</Card>
				</div>
				<Card>
					<CardHeader className="flex flex-row items-center">
						<div>
							<CardTitle>Recent activity</CardTitle>
							<CardDescription>
								This demo uses fake data, but interactions behave like the real
								app.
							</CardDescription>
						</div>
						<CardAction>
							<Button asChild variant="outline" size="sm">
								<Link to="/tasks">Go to tasks</Link>
							</Button>
						</CardAction>
					</CardHeader>
					<CardContent className="text-sm text-muted-foreground">
						Explore tasks, update statuses, and link them to competitions to see
						how everything fits together.
					</CardContent>
				</Card>
			</div>
		</>
	);
}
