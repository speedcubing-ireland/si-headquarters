import { PencilLine, Trash2 } from "lucide-react";
import { EditablePhaseCell } from "@/components/competitions/editable-phase-and-roles";
import type { CompetitionTaskSummary } from "@/components/competitions/competition-detail-utils";
import { DetailSummaryStat } from "@/components/shared/detail-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Competition } from "@/data/types-new";
import {
	getCurrentPhaseKey,
	getPhaseLabel,
	getPhaseVariant,
} from "@/lib/competition-phase-config";

export function CompetitionOverviewPanel({
	competition,
	canEdit,
	canDelete,
	isSubscribed,
	onToggleSubscription,
	onEditDetails,
	onDelete,
	taskSummary,
}: {
	competition: Competition;
	canEdit: boolean;
	canDelete: boolean;
	isSubscribed: boolean;
	onToggleSubscription?: () => void;
	onEditDetails: () => void;
	onDelete: () => void;
	taskSummary: CompetitionTaskSummary;
}) {
	const currentPhaseKey = getCurrentPhaseKey(competition);

	return (
		<section className="overflow-hidden rounded-lg border bg-card">
			<div className="border-b bg-muted/20 px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
				<div className="flex flex-col gap-4">
					<div className="flex items-start gap-4">
						<div className="flex size-16 shrink-0 items-center justify-center rounded-lg border bg-background text-2xl font-semibold text-foreground sm:size-20">
							{competition.name.slice(0, 1).toUpperCase()}
						</div>
						<div className="min-w-0 flex-1">
							<h1 className="min-w-0 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
								{competition.name}
							</h1>
							<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
								{competition.description?.trim() ||
									"Add a short description so the team immediately understands the competition context."}
							</p>
						</div>
					</div>

					<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							<DetailSummaryStat
								label="Phase tasks"
								value={String(taskSummary.phaseTaskCount)}
							/>
							<DetailSummaryStat
								label="Done"
								value={String(taskSummary.done)}
								tone="positive"
							/>
							<DetailSummaryStat
								label="In progress"
								value={String(taskSummary.inProgress)}
								tone="warning"
							/>
							<DetailSummaryStat
								label="Blocked"
								value={String(taskSummary.blocked)}
								tone={taskSummary.blocked > 0 ? "danger" : "neutral"}
							/>
						</div>

						<div className="rounded-lg border bg-card p-3">
							<div className="flex flex-col gap-3">
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="text-[11px] uppercase tracking-wide text-muted-foreground">
											Current phase
										</div>
										<div className="mt-2">
											{canEdit ? (
												<EditablePhaseCell
													competition={competition}
													buttonClassName="h-auto min-w-0 max-w-full justify-start px-0 py-0 hover:bg-transparent"
													badgeClassName="text-sm"
												/>
											) : (
												<Badge
													variant={getPhaseVariant(currentPhaseKey)}
													className="text-sm"
												>
													{getPhaseLabel(currentPhaseKey)}
												</Badge>
											)}
										</div>
									</div>
									<div className="text-right">
										<div className="text-[11px] uppercase tracking-wide text-muted-foreground">
											Completion
										</div>
										<div className="mt-1 text-2xl font-semibold">
											{taskSummary.completionPercent}%
										</div>
									</div>
								</div>
								<div className="h-2 rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-success transition-[width]"
										style={{ width: `${taskSummary.completionPercent}%` }}
									/>
								</div>
							</div>
						</div>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
						{onToggleSubscription ? (
							<Button
								size="lg"
								onClick={onToggleSubscription}
								variant={isSubscribed ? "secondary" : "default"}
								className="min-h-11 w-full px-5 sm:w-auto"
							>
								{isSubscribed ? "Watching competition" : "Watch competition"}
							</Button>
						) : null}
						{canEdit ? (
							<Button
								variant="outline"
								size="lg"
								className="min-h-11 w-full px-5 sm:w-auto"
								onClick={onEditDetails}
							>
								<PencilLine className="size-4" />
								Edit name and description
							</Button>
						) : null}
						{canDelete ? (
							<Button
								variant="destructive"
								size="lg"
								onClick={onDelete}
								className="min-h-11 w-full px-5 sm:ml-auto sm:w-auto"
							>
								<Trash2 className="size-4" />
								Delete competition
							</Button>
						) : null}
					</div>
				</div>
			</div>
		</section>
	);
}
