import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Inbox } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDataV2 } from "@/data/data-store-v2";
import type { Competition, ProgressUpdate, Task } from "@/data/types-new";
import { formatDateShort } from "@/lib/task-utils";

export const Route = createFileRoute("/inbox")({
	component: RouteComponent,
});

type InboxItem =
	| {
			type: "task-assigned";
			task: Task;
	  }
	| {
			type: "task-due-soon";
			task: Task;
	  }
	| {
			type: "competition-update";
			competition: Competition;
			update: ProgressUpdate;
	  };

function useInboxItems(): InboxItem[] {
	const users = useDataV2((state) => state.users);
	const tasks = useDataV2((state) => state.tasks);
	const competitions = useDataV2((state) => state.competitions);

	const currentUser = users[0];

	return useMemo(() => {
		if (!currentUser) return [];

		const items: InboxItem[] = [];

		for (const task of tasks) {
			if (task.assignee?.id === currentUser.id) {
				items.push({ type: "task-assigned", task });
			}

			if (
				task.assignee?.id === currentUser.id &&
				task.dueDate &&
				task.status !== "done"
			) {
				items.push({ type: "task-due-soon", task });
			}
		}

		for (const competition of competitions) {
			for (const update of competition.progressUpdates) {
				items.push({ type: "competition-update", competition, update });
			}
		}

		// Sort newest first by the most relevant timestamp
		return items.sort((a, b) => {
			const getTimestamp = (item: InboxItem) => {
				if (item.type === "competition-update") {
					return item.update.timestamp;
				}
				return item.task.updatedAt;
			};
			return getTimestamp(b).localeCompare(getTimestamp(a));
		});
	}, [currentUser, tasks, competitions]);
}

function RouteComponent() {
	const items = useInboxItems();

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b">
				<div className="flex items-center gap-2 px-4 lg:px-6">
					<Inbox className="size-4 text-muted-foreground" />
					<h1 className="text-sm font-semibold">Inbox</h1>
					<Separator
						orientation="vertical"
						className="mx-2 h-4 bg-border"
					/>
					<p className="text-xs text-muted-foreground">
						Notifications from tasks and competitions assigned to you.
					</p>
				</div>
			</header>

			<div className="flex-1 space-y-3 px-4 lg:px-6">
				{items.length === 0 ? (
					<Card className="border-dashed">
						<CardHeader>
							<CardTitle className="text-sm font-medium">
								You&apos;re all caught up
							</CardTitle>
						</CardHeader>
						<CardContent className="text-sm text-muted-foreground">
							There are no notifications right now. As tasks and competitions are
							updated, they&apos;ll appear here.
						</CardContent>
					</Card>
				) : (
					<div className="space-y-2">
						{items.map((item, index) => {
							if (item.type === "task-assigned" || item.type === "task-due-soon") {
								const isDueSoon = item.type === "task-due-soon";
								return (
									<Card
										key={`task-${item.task.id}-${index}`}
										className="border-border/60"
									>
										<CardContent className="flex items-center justify-between gap-3 py-3">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<Badge
														variant={isDueSoon ? "destructive" : "outline"}
														className="text-[10px]"
													>
														{isDueSoon ? "Due soon" : "New assignment"}
													</Badge>
													<span className="text-xs text-muted-foreground">
														Updated {formatDateShort(item.task.updatedAt)}
													</span>
												</div>
												<div className="flex items-center gap-2 text-sm">
													<span className="font-mono text-xs text-muted-foreground">
														{item.task.identifier}
													</span>
													<span className="font-medium">{item.task.title}</span>
												</div>
											</div>
											<Button
												asChild
												variant="ghost"
												size="sm"
												className="gap-1"
											>
												<Link
													to="/tasks/$id"
													params={{ id: item.task.id }}
												>
													Open task
													<ArrowRight className="size-3.5" />
												</Link>
											</Button>
										</CardContent>
									</Card>
								);
							}

							return (
								<Card
									key={`comp-${item.competition.id}-${item.update.id}-${index}`}
									className="border-border/60"
								>
									<CardContent className="flex items-center justify-between gap-3 py-3">
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<Badge variant="outline" className="text-[10px]">
													Competition update
												</Badge>
												<span className="text-xs text-muted-foreground">
													{formatDateShort(item.update.timestamp)}
												</span>
											</div>
											<div className="text-sm">
												<p className="font-medium">
													{item.competition.name}
												</p>
												{item.update.message && (
													<p className="text-muted-foreground text-xs">
														{item.update.message}
													</p>
												)}
											</div>
										</div>
										<Button
											asChild
											variant="ghost"
											size="sm"
											className="gap-1"
										>
											<Link
												to="/competitions/$id"
												params={{ id: item.competition.id }}
											>
												Open competition
												<ArrowRight className="size-3.5" />
											</Link>
										</Button>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

