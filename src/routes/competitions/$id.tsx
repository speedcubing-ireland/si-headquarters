import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CompetitionDetails } from "@/components/competitions/competition-details";
import { CompetitionLatestUpdate } from "@/components/competitions/competition-latest-update";
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

function CompetitionHeader({ competition }: { competition: Competition }) {
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
			<CompetitionHeader competition={competitionWithTasks} />
			<main className="min-w-0 flex-1 overflow-x-hidden">
				<div className="h-full overflow-y-auto overflow-x-hidden">
					<div className="mx-auto w-full max-w-6xl min-w-0 space-y-6 px-3 pb-4 pt-0 sm:space-y-7 sm:px-4 sm:pb-5 sm:pt-0 lg:space-y-8 lg:px-8 lg:pb-8 lg:pt-0">
						<CompetitionDetails
							competition={competitionWithTasks}
							isEditable
							isSubscribed={isSubscribed}
							onToggleSubscription={handleToggleSubscription}
							taskSummary={{
								...taskSummary,
								phaseTaskCount,
								completionPercent,
							}}
							onUpdate={(updates) => updateCompetition(competition.id, updates)}
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
		</div>
	);
}
