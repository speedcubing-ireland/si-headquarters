import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { CompetitionDetails } from "@/components/competitions/competition-details";
import { CompetitionLatestUpdate } from "@/components/competitions/competition-latest-update";
import { CompetitionPropertiesSidebar } from "@/components/competitions/competition-properties-sidebar";
import { CompetitionTasksByPhase } from "@/components/competitions/competition-tasks-by-phase";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { requireCompetitionId } from "@/lib/convex-ids";
import {
	useCompetition,
	useTasksForCompetition,
	useCompetitionMutations,
} from "@/hooks/use-convex-data";
import type { Competition, Task } from "@/data/types-new";

export const Route = createFileRoute("/competitions/$id")({
	component: RouteComponent,
});

function CompetitionHeader({
	competition,
	onPropertiesClick,
}: {
	competition: Competition;
	onPropertiesClick: () => void;
}) {
	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
			<Link
				to="/competitions"
				className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				<span className="text-sm hidden sm:inline">Back to Competitions</span>
			</Link>
			<Separator orientation="vertical" className="mx-2 h-4" />
			<h1 className="truncate text-sm font-semibold max-w-[200px] sm:max-w-[300px]">
				{competition.name}
			</h1>
			<div className="ml-auto flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={onPropertiesClick}
					className="lg:hidden gap-1.5"
				>
					<span className="hidden sm:inline">Properties</span>
					<MoreHorizontal className="size-4 sm:hidden" />
				</Button>
				{competition.compSheet && (
					<a
						href={`https://docs.google.com/spreadsheets/d/${competition.compSheet.sheetId}`}
						target="_blank"
						rel="noreferrer"
						className="hidden sm:block"
					>
						<Button variant="ghost" size="sm" className="gap-1">
							<ExternalLink className="size-4" />
							Sheet
						</Button>
					</a>
				)}
			</div>
		</header>
	);
}

function RouteComponent() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const competitionId = requireCompetitionId(id);
	const competition = useCompetition(competitionId);
	const { tasks: scopedTasks } = useTasksForCompetition(competitionId);
	const { updateCompetition, deleteCompetition } = useCompetitionMutations();
	const [propertiesPopoverOpen, setPropertiesPopoverOpen] = useState(false);

	const handleDelete = async () => {
		try {
			await deleteCompetition(competitionId);
			navigate({ to: "/competitions" });
		} catch (error) {
			console.error("Failed to delete competition:", error);
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

	return (
		<div className="flex h-full flex-col">
			<CompetitionHeader
				competition={competitionWithTasks}
				onPropertiesClick={() => setPropertiesPopoverOpen(true)}
			/>
			<div className="flex flex-1 overflow-hidden">
				<main className="flex-1 overflow-hidden">
					<ScrollArea className="h-full">
						<div className="mx-auto max-w-4xl space-y-8 px-6 py-6 lg:px-8 lg:py-8">
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
					</ScrollArea>
				</main>
				<CompetitionPropertiesSidebar
					competition={competitionWithTasks}
					tasks={scopedTasks}
					renderMode="sidebar"
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
