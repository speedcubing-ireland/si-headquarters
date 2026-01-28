"use client";

import { CalendarDays, CircleDot, ListChecks, Users } from "lucide-react";
import { useCallback } from "react";

import { LeadsDisplay } from "@/components/competitions/leads-display";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useDataV2 } from "@/data/data-store-v2";
import type { Competition, Task } from "@/data/types-new";
import { formatDateShort } from "@/lib/task-utils";

interface CompetitionPropertiesSidebarProps {
	competition: Competition;
	tasks: Task[];
}

export function CompetitionPropertiesSidebar({
	competition,
	tasks,
}: CompetitionPropertiesSidebarProps) {
	const updateCompetition = useDataV2((state) => state.updateCompetition);

	const currentPhase = competition.phases[competition.currentPhaseIdx];

	const totalTasks = tasks.length;
	const completedTasks = tasks.filter((task) => task.status === "done").length;
	const inProgressTasks = tasks.filter(
		(task) => task.status === "in-progress",
	).length;

	const handleSetCurrentPhase = useCallback(
		(index: number) => {
			updateCompetition(competition.id, { currentPhaseIdx: index });
		},
		[competition.id, updateCompetition],
	);

	return (
		<aside className="w-80 border-l border-border bg-background">
			<ScrollArea className="h-full">
				<div className="space-y-6 p-4">
					<section className="space-y-3">
						<div className="text-xs font-medium text-muted-foreground">
							Properties
						</div>
						<div className="space-y-2 text-sm">
							<PropertyRow label="Status">
								<button
									type="button"
									className="inline-flex items-center gap-1.5 rounded px-1 hover:bg-muted/60"
									onClick={() => {
										if (!currentPhase) return;
										const idx = competition.phases.findIndex(
											(p) => p.id === currentPhase.id,
										);
										if (idx >= 0) {
											handleSetCurrentPhase(idx);
										}
									}}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											if (!currentPhase) return;
											const idx = competition.phases.findIndex(
												(p) => p.id === currentPhase.id,
											);
											if (idx >= 0) {
												handleSetCurrentPhase(idx);
											}
										}
									}}
								>
									<CircleDot className="size-3.5 text-warning" />
									<span className="text-foreground">
										{currentPhase ? currentPhase.name : "No phase"}
									</span>
								</button>
							</PropertyRow>
							<PropertyRow label="Date range">
								<div className="flex items-center justify-end gap-2">
									<div className="inline-flex items-center gap-1.5">
										<CalendarDays className="size-3.5 text-muted-foreground" />
										<span className="text-xs text-foreground">
											{formatDateShort(competition.compStart)} –{" "}
											{formatDateShort(competition.compEnd)}
										</span>
									</div>
								</div>
							</PropertyRow>
							<PropertyRow label="Tasks">
								<div className="inline-flex items-center gap-1.5">
									<ListChecks className="size-3.5 text-muted-foreground" />
									<span className="text-xs text-muted-foreground">
										<span className="font-medium text-foreground">
											{completedTasks}
										</span>{" "}
										done ·{" "}
										<span className="font-medium text-foreground">
											{inProgressTasks}
										</span>{" "}
										in progress ·{" "}
										<span className="font-medium text-foreground">
											{totalTasks}
										</span>{" "}
										total
									</span>
								</div>
							</PropertyRow>
						</div>
					</section>

					<Separator />

					<section className="space-y-3">
						<div className="text-xs font-medium text-muted-foreground">
							People
						</div>
						<div className="space-y-2 text-sm">
							<PropertyRow label="Competition lead">
								<LeadsDisplay
									leads={competition.compLead ? [competition.compLead] : []}
									variant="compact"
								/>
							</PropertyRow>
							<PropertyRow label="Lead delegate">
								<LeadsDisplay
									leads={competition.leadDelegate ? [competition.leadDelegate] : []}
									variant="compact"
								/>
							</PropertyRow>
							<PropertyRow label="Organisers">
								<div className="inline-flex items-center gap-1.5">
									<Users className="size-3.5 text-muted-foreground" />
									<span className="text-xs text-foreground">
										{competition.organisers.length} organiser
										{competition.organisers.length === 1 ? "" : "s"}
									</span>
								</div>
							</PropertyRow>
						</div>
					</section>

					<Separator />

					<section className="space-y-3">
						<div className="text-xs font-medium text-muted-foreground">
							Phases
						</div>
						<div className="space-y-1">
							{competition.phases.map((phase, index) => {
								const isCurrent = index === competition.currentPhaseIdx;

								return (
									<button
										key={phase.id}
										type="button"
										className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-accent"
										onClick={() => handleSetCurrentPhase(index)}
									>
										<div className="flex items-center gap-2">
											<span className="size-1.5 rounded-full bg-muted-foreground/40" />
											<span
												className={
													isCurrent
														? "font-medium text-foreground"
														: "text-muted-foreground"
												}
											>
												{phase.name}
											</span>
										</div>
										{isCurrent && (
											<Badge
												variant="outline"
												className="h-4 border-border bg-background text-[10px] font-normal"
											>
												Current
											</Badge>
										)}
									</button>
								);
							})}
						</div>
					</section>
				</div>
			</ScrollArea>
		</aside>
	);
}

function PropertyRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-2">
			<span className="text-xs text-muted-foreground">{label}</span>
			<div className="flex-1 text-right">{children}</div>
		</div>
	);
}

