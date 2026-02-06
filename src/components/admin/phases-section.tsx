import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";

const getErrorMessage = (error: unknown) =>
	error instanceof Error ? error.message : "Something went wrong.";

type AdminPhase = {
	id: Id<"phases">;
	key: string;
	name: string;
	description: string;
	order: number;
	archived: boolean;
	taskUsageCount: number;
	competitionUsageCount: number;
};

function useAdminPhases(): { phases: AdminPhase[]; isLoading: boolean } {
	const data = useQuery(api.admin.listPhasesWithUsage, {});
	const phases: AdminPhase[] =
		data?.map((p) => ({
			id: p.id,
			key: p.key,
			name: p.name,
			description: p.description,
			order: p.order,
			archived: p.archived,
			taskUsageCount: p.taskUsageCount,
			competitionUsageCount: p.competitionUsageCount,
		})) ?? [];
	return {
		phases,
		isLoading: data === undefined,
	};
}

function useAdminPhaseMutations() {
	const createPhaseMutation = useMutation(api.admin.createPhaseAdmin);
	const updatePhaseMutation = useMutation(api.admin.updatePhaseAdmin);
	const deletePhaseMutation = useMutation(api.admin.deletePhaseIfUnused);

	return {
		createPhase: async (payload: {
			key: string;
			name: string;
			description: string;
		}) => {
			await createPhaseMutation({
				key: payload.key,
				name: payload.name,
				description: payload.description,
			});
		},
		updatePhase: async (
			id: Id<"phases">,
			updates: {
				name?: string;
				description?: string;
				order?: number;
				archived?: boolean;
			},
		) => {
			await updatePhaseMutation({
				id,
				...updates,
			});
		},
		deletePhaseIfUnused: async (id: Id<"phases">) => {
			await deletePhaseMutation({ id });
		},
	};
}

function slugifyKey(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

export function PhasesSection() {
	const { phases, isLoading } = useAdminPhases();
	const { createPhase, updatePhase, deletePhaseIfUnused } =
		useAdminPhaseMutations();

	const [newKey, setNewKey] = useState("");
	const [newName, setNewName] = useState("");
	const [newDescription, setNewDescription] = useState("");
	const [savingId, setSavingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleCreatePhase = async () => {
		const key = (newKey || newName).trim();
		if (!key || !newName.trim()) return;
		setError(null);
		try {
			await createPhase({
				key: slugifyKey(key),
				name: newName.trim(),
				description: newDescription.trim(),
			});
			setNewKey("");
			setNewName("");
			setNewDescription("");
		} catch (e) {
			setError(getErrorMessage(e));
		}
	};

	const handleUpdatePhase = async (
		phaseId: Id<"phases">,
		updates: {
			name?: string;
			description?: string;
			order?: number;
			archived?: boolean;
		},
	) => {
		setSavingId(phaseId);
		setError(null);
		try {
			await updatePhase(phaseId, updates);
		} catch (e) {
			setError(getErrorMessage(e));
		} finally {
			setSavingId(null);
		}
	};

	const handleDeletePhase = async (phaseId: Id<"phases">) => {
		setSavingId(phaseId);
		setError(null);
		try {
			await deletePhaseIfUnused(phaseId);
		} catch (e) {
			setError(getErrorMessage(e));
		} finally {
			setSavingId(null);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<span>Global Phases</span>
					<span className="text-xs text-muted-foreground">
						Edit global phases with safety checks
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{isLoading ? (
					<div className="py-6 flex items-center justify-center">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				) : (
					<>
						{error && (
							<div className="text-xs text-destructive wrap-break-word">
								{error}
							</div>
						)}

						{phases.length === 0 ? (
							<div className="py-2 text-sm text-muted-foreground">
								No phases found yet. Use the form below to create the first
								phase.
							</div>
						) : (
							<>
								<div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-2 text-xs font-medium text-muted-foreground">
									<span>Key</span>
									<span>Name</span>
									<span>Description</span>
									<span className="text-right">Usage / Actions</span>
								</div>
								<div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs">
									{phases.map((phase) => (
										<div
											key={phase.id}
											className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-2"
										>
											<div className="truncate text-[11px] text-muted-foreground">
												{phase.key}
											</div>
											<Input
												defaultValue={phase.name}
												className="h-7 text-xs"
												onBlur={(e) =>
													e.target.value !== phase.name &&
													void handleUpdatePhase(phase.id, {
														name: e.target.value.trim() || phase.name,
													})
												}
											/>
											<Input
												defaultValue={phase.description}
												className="h-7 text-xs"
												onBlur={(e) =>
													e.target.value !== phase.description &&
													void handleUpdatePhase(phase.id, {
														description:
															e.target.value.trim() || phase.description,
													})
												}
											/>
											<div className="flex items-center justify-end gap-1">
												<span className="text-[10px] text-muted-foreground">
													T:{phase.taskUsageCount} C:
													{phase.competitionUsageCount}
												</span>
												<div className="flex items-center gap-1">
													<Button
														size="sm"
														variant="outline"
														className="h-7 px-2 text-[11px]"
														onClick={() => {
															const idx = phases.findIndex(
																(p) => p.id === phase.id,
															);
															if (idx <= 0) return;
															const above = phases[idx - 1];
															void (async () => {
																setSavingId(phase.id);
																setError(null);
																try {
																	await Promise.all([
																		updatePhase(phase.id, {
																			order: above.order,
																		}),
																		updatePhase(above.id, {
																			order: phase.order,
																		}),
																	]);
																} catch (e) {
																	setError(getErrorMessage(e));
																} finally {
																	setSavingId(null);
																}
															})();
														}}
														disabled={
															savingId === phase.id ||
															phases.findIndex((p) => p.id === phase.id) === 0
														}
													>
														↑
													</Button>
													<Button
														size="sm"
														variant="outline"
														className="h-7 px-2 text-[11px]"
														onClick={() => {
															const idx = phases.findIndex(
																(p) => p.id === phase.id,
															);
															if (idx === -1 || idx === phases.length - 1)
																return;
															const below = phases[idx + 1];
															void (async () => {
																setSavingId(phase.id);
																setError(null);
																try {
																	await Promise.all([
																		updatePhase(phase.id, {
																			order: below.order,
																		}),
																		updatePhase(below.id, {
																			order: phase.order,
																		}),
																	]);
																} catch (e) {
																	setError(getErrorMessage(e));
																} finally {
																	setSavingId(null);
																}
															})();
														}}
														disabled={
															savingId === phase.id ||
															phases.findIndex((p) => p.id === phase.id) ===
																phases.length - 1
														}
													>
														↓
													</Button>
												</div>
												<Button
													size="sm"
													variant="outline"
													className="h-7 px-2 text-[11px]"
													onClick={() =>
														void handleUpdatePhase(phase.id, {
															archived: !phase.archived,
														})
													}
													disabled={savingId === phase.id}
												>
													{phase.archived ? "Unarchive" : "Archive"}
												</Button>
												<Button
													size="sm"
													variant="outline"
													className="h-7 px-2 text-[11px] text-destructive border-destructive"
													onClick={() => void handleDeletePhase(phase.id)}
													disabled={
														savingId === phase.id ||
														phase.taskUsageCount > 0 ||
														phase.competitionUsageCount > 0
													}
													title={
														phase.taskUsageCount > 0 ||
														phase.competitionUsageCount > 0
															? "Cannot delete a phase that is still in use"
															: "Delete phase"
													}
												>
													Delete
												</Button>
											</div>
										</div>
									))}
								</div>
							</>
						)}

						<div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
							<Input
								placeholder="Key (optional, derived from name if blank)"
								value={newKey}
								onChange={(e) => setNewKey(e.target.value)}
								className="h-7 w-52"
							/>
							<Input
								placeholder="New phase name"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								className="h-7 w-40"
							/>
							<Input
								placeholder="Description"
								value={newDescription}
								onChange={(e) => setNewDescription(e.target.value)}
								className="h-7 w-56"
							/>
							<Button
								size="sm"
								className="h-7 px-3 text-[11px]"
								onClick={() => void handleCreatePhase()}
							>
								Add phase
							</Button>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
