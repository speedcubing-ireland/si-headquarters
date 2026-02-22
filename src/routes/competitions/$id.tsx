import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Bell, ExternalLink, Globe, PanelRight } from "lucide-react";
import { useState } from "react";
import { CompetitionDetails } from "@/components/competitions/competition-details";
import { CompetitionLatestUpdate } from "@/components/competitions/competition-latest-update";
import { CompetitionPropertiesSidebar } from "@/components/competitions/competition-properties-sidebar";
import { CompetitionTasksByPhase } from "@/components/competitions/competition-tasks-by-phase";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requireCompetitionId } from "@/lib/convex-ids";
import { isFinishedTask } from "@/lib/competition-phase-task-view";
import {
	useCompetition,
	useNotificationMutations,
	useNotificationSubscriptions,
	useTasksForCompetition,
	useCompetitionMutations,
} from "@/hooks/use-convex-data";
import type { Competition, Task } from "@/data/types-new";
import { onMutationError } from "@/lib/utils";

export const Route = createFileRoute("/competitions/$id")({
	component: RouteComponent,
});

function SummaryStat({
	label,
	value,
	tone = "neutral",
}: {
	label: string;
	value: string;
	tone?: "neutral" | "positive" | "warning" | "danger";
}) {
	const toneClass =
		tone === "positive"
			? "text-success"
			: tone === "warning"
				? "text-warning"
				: tone === "danger"
					? "text-destructive"
					: "text-foreground";

	return (
		<div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2.5">
			<div className="text-[11px] uppercase tracking-wide text-muted-foreground">
				{label}
			</div>
			<div className={`mt-0.5 text-base font-semibold ${toneClass}`}>
				{value}
			</div>
		</div>
	);
}

function CompetitionHeader({
	competition,
	onPropertiesClick,
	isSubscribed,
	onToggleSubscription,
}: {
	competition: Competition;
	onPropertiesClick: () => void;
	isSubscribed: boolean;
	onToggleSubscription: () => void;
}) {
	return (
		<PageHeader.Root withBottomBorder={false}>
			<SidebarTrigger className="shrink-0" />
			<PageHeader.Divider />
			<Link
				to="/competitions"
				className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				<span className="text-sm hidden sm:inline">Back to Competitions</span>
			</Link>
			<PageHeader.Divider className="mx-2" />
			<h1 className="max-w-[180px] truncate text-sm font-semibold sm:max-w-[300px]">
				{competition.name}
			</h1>
			<div className="ml-auto flex items-center gap-2">
				<Button
					variant={isSubscribed ? "secondary" : "outline"}
					size="sm"
					onClick={onToggleSubscription}
					className="gap-1.5"
				>
					<Bell className="size-4" />
					<span className="hidden sm:inline">
						{isSubscribed ? "Watching" : "Watch"}
					</span>
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={onPropertiesClick}
					className="gap-1.5 lg:hidden"
				>
					<PanelRight className="size-4" />
					<span className="hidden sm:inline">Properties</span>
				</Button>
				{competition.compSheet && (
					<a
						href={`https://docs.google.com/spreadsheets/d/${competition.compSheet.sheetId}`}
						target="_blank"
						rel="noreferrer"
					>
						<Button variant="ghost" size="sm" className="gap-1">
							<ExternalLink className="size-4" />
							<span className="hidden sm:inline">Sheet</span>
						</Button>
					</a>
				)}
				{competition.wcaCompetitionId && (
					<a
						href={`https://www.worldcubeassociation.org/competitions/${competition.wcaCompetitionId}`}
						target="_blank"
						rel="noreferrer"
					>
						<Button variant="ghost" size="sm" className="gap-1">
							<Globe className="size-4" />
							<span className="hidden sm:inline">WCA</span>
						</Button>
					</a>
				)}
			</div>
		</PageHeader.Root>
	);
}

function RouteComponent() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const competitionId = requireCompetitionId(id);
	const competition = useCompetition(competitionId);
	const { tasks: scopedTasks } = useTasksForCompetition(competitionId);
	const { subscriptions } = useNotificationSubscriptions();
	const { subscribeToCompetition, unsubscribeFromCompetition } =
		useNotificationMutations();
	const { updateCompetition, deleteCompetition } = useCompetitionMutations();
	const [propertiesPopoverOpen, setPropertiesPopoverOpen] = useState(false);
	const isSubscribed = subscriptions.some(
		(subscription) =>
			subscription.entityType === "competition" &&
			subscription.entityId === competitionId,
	);

	const handleToggleSubscription = () => {
		if (isSubscribed) {
			void unsubscribeFromCompetition(competitionId).catch(onMutationError);
			return;
		}
		void subscribeToCompetition(competitionId).catch(onMutationError);
	};

	const handleDelete = async () => {
		try {
			await deleteCompetition(competitionId);
			void navigate({ to: "/competitions" });
		} catch (error) {
			onMutationError(error);
		}
	};

	if (competition === undefined) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	if (competition === null) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center">
					<h2 className="text-lg font-medium">Competition not found</h2>
					<p className="text-muted-foreground">
						The competition you&apos;re looking for doesn&apos;t exist.
					</p>
					<Link to="/competitions">
						<Button className="mt-4">Back to Competitions</Button>
					</Link>
				</div>
			</div>
		);
	}

	const competitionWithTasks: Competition & { tasks: Task[] } = {
		...competition,
		tasks: scopedTasks,
	};
	const total = scopedTasks.length;
	const done = scopedTasks.filter((task) => task.status === "done").length;
	const inProgress = scopedTasks.filter(
		(task) => task.status === "in-progress",
	).length;
	const blocked = scopedTasks.filter(
		(task) => task.isBlocked && task.unresolvedBlockerCount > 0,
	).length;
	const taskSummary = { total, done, inProgress, blocked };
	const currentPhaseId = competition.phases[competition.currentPhaseIdx]?.id;
	const currentPhaseTasks = currentPhaseId
		? scopedTasks.filter((task) => task.phase?.id === currentPhaseId)
		: scopedTasks;
	const currentPhaseCompleted = currentPhaseTasks.filter(isFinishedTask).length;
	const phaseTaskCount = currentPhaseTasks.length;
	const completionPercent =
		currentPhaseTasks.length === 0
			? 0
			: Math.round((currentPhaseCompleted / currentPhaseTasks.length) * 100);

	return (
		<div className="flex h-full flex-col overflow-x-hidden">
			<CompetitionHeader
				competition={competitionWithTasks}
				onPropertiesClick={() => setPropertiesPopoverOpen(true)}
				isSubscribed={isSubscribed}
				onToggleSubscription={handleToggleSubscription}
			/>
			<div className="flex min-w-0 flex-1 overflow-hidden">
				<main className="min-w-0 flex-1 overflow-x-hidden">
					<div className="h-full overflow-y-auto overflow-x-hidden">
						<div className="mx-auto w-full max-w-5xl min-w-0 space-y-6 px-3 pb-4 pt-0 sm:space-y-7 sm:px-4 sm:pb-5 sm:pt-0 lg:space-y-8 lg:px-8 lg:pb-8 lg:pt-0">
							<section className="rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-4">
								<div className="mb-3 flex items-center justify-between gap-2">
									<h2 className="text-sm font-medium text-muted-foreground">
										Competition overview
									</h2>
									<span className="text-xs text-muted-foreground">
										Live task snapshot
									</span>
								</div>
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
									<SummaryStat
										label="Phase tasks"
										value={String(phaseTaskCount)}
									/>
									<SummaryStat
										label="Done"
										value={String(taskSummary.done)}
										tone="positive"
									/>
									<SummaryStat
										label="In progress"
										value={String(taskSummary.inProgress)}
										tone="warning"
									/>
									<SummaryStat
										label="Blocked"
										value={String(taskSummary.blocked)}
										tone={taskSummary.blocked > 0 ? "danger" : "neutral"}
									/>
								</div>
								<div className="mt-3 rounded-lg border border-border/70 bg-background/80 px-3 py-2.5">
									<div className="flex items-center justify-between gap-2 text-xs">
										<span className="text-muted-foreground">
											Phase Completion
										</span>
										<span className="font-medium">
											{completionPercent}% complete
										</span>
									</div>
									<div className="mt-2 h-2 rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-success transition-[width]"
											style={{ width: `${completionPercent}%` }}
										/>
									</div>
								</div>
							</section>
							<CompetitionDetails
								competition={competitionWithTasks}
								isEditable
								onUpdate={(updates) =>
									updateCompetition(competition.id, updates)
								}
								onDelete={handleDelete}
							/>
							<CompetitionLatestUpdate competition={competitionWithTasks} />
							<Separator />
							<CompetitionTasksByPhase
								competition={competitionWithTasks}
								tasks={scopedTasks}
							/>
						</div>
					</div>
				</main>
				<CompetitionPropertiesSidebar
					competition={competitionWithTasks}
					tasks={scopedTasks}
					renderMode="sidebar"
					showMobileTrigger={false}
				/>
			</div>
			<CompetitionPropertiesSidebar
				competition={competitionWithTasks}
				tasks={scopedTasks}
				renderMode="popover"
				open={propertiesPopoverOpen}
				onOpenChange={setPropertiesPopoverOpen}
			/>
		</div>
	);
}
