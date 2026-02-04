import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	useAdminMembersAndTeams,
	useAdminMemberMutations,
	useIsDirector,
	useLabelMutations,
} from "@/hooks/use-convex-data";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";

function useAdminLabels() {
	const data = useQuery(api.admin.listLabelsWithUsage, {});
	const labels =
		data?.map((l) => ({
			id: l.id as Id<"labels">,
			name: l.name,
			color: l.color,
			archived: l.archived,
			usageCount: l.usageCount,
		})) ?? [];
	return {
		labels,
		isLoading: data === undefined,
	};
}

export const Route = createFileRoute("/admin/god-mode")({
	component: GodModePage,
});

function GodModePage() {
	const { isDirector, isLoading: isDirectorLoading } = useIsDirector();

	if (isDirectorLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!isDirector) {
		// Hide the page from non-directors; send them home.
		return <Navigate to="/" />;
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
				<h1 className="text-sm font-semibold">God Mode</h1>
				<span className="text-xs text-muted-foreground">
					Directors-only data management
				</span>
			</header>

			<div className="flex flex-1 flex-col gap-4 px-4 lg:px-6">
				<div className="grid gap-4 lg:grid-cols-3">
					<div className="lg:col-span-2">
						<MembersAndTeamsSection />
					</div>
					<div className="lg:col-span-1">
						<LabelsSection />
					</div>
				</div>
				<PhasesSection />
			</div>
		</div>
	);
}

function MembersAndTeamsSection() {
	const { users, teams, isLoading } = useAdminMembersAndTeams();
	const { updateTeamMembers } = useAdminMemberMutations();

	const [selectedTeamId, setSelectedTeamId] = useState<Id<"teams"> | null>(null);

	const selectedTeam = useMemo(
		() => teams.find((t) => t.id === selectedTeamId) ?? null,
		[teams, selectedTeamId],
	);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Members &amp; Teams</CardTitle>
				</CardHeader>
				<CardContent className="py-8 flex items-center justify-center">
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	const handleToggleMember = async (userId: Id<"users">) => {
		if (!selectedTeam) return;
		const isMember = selectedTeam.memberIds.includes(userId);
		const nextMembers = isMember
			? selectedTeam.memberIds.filter((id) => id !== userId)
			: [...selectedTeam.memberIds, userId];
		await updateTeamMembers(selectedTeam.id, nextMembers);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<span>Members &amp; Teams</span>
					<span className="text-xs text-muted-foreground">
						Manage team membership and Directors
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">Team</span>
					<Select
						value={selectedTeamId ?? ""}
						onValueChange={(value) =>
							setSelectedTeamId(value ? (value as Id<"teams">) : null)
						}
					>
						<SelectTrigger className="w-56">
							<SelectValue placeholder="Select a team" />
						</SelectTrigger>
						<SelectContent>
							{teams.map((team) => (
								<SelectItem key={team.id} value={team.id}>
									{team.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{!selectedTeam ? (
					<div className="text-sm text-muted-foreground">
						Select a team to edit its members.
					</div>
				) : (
					<div className="space-y-2">
						<div className="text-xs font-medium text-muted-foreground">
							Click a user to add/remove them from{" "}
							<span className="font-semibold">{selectedTeam.name}</span>.
						</div>
						<div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
							{users.map((user) => {
								const isMember = selectedTeam.memberIds.includes(user.id);
								const isDirectorTeam =
									selectedTeam.name.toLowerCase() === "directors";
								return (
									<button
										key={user.id}
										type="button"
										onClick={() => void handleToggleMember(user.id)}
										className={`flex items-center justify-between rounded border px-3 py-1.5 text-left text-sm transition-colors ${
											isMember
												? "border-primary bg-primary/5"
												: "border-border hover:bg-muted/60"
										}`}
									>
										<span className="truncate">{user.name || "Unnamed"}</span>
										<div className="flex items-center gap-1">
											{isDirectorTeam && user.teamIds.includes(selectedTeam.id) && (
												<Badge
													variant="outline"
													className="border-amber-500 text-amber-700 text-[10px]"
												>
													Director
												</Badge>
											)}
											{isMember && (
												<Badge
													variant="outline"
													className="text-[10px] border-primary text-primary"
												>
													Member
												</Badge>
											)}
										</div>
									</button>
								);
							})}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function LabelsSection() {
	const { labels, isLoading } = useAdminLabels();
	const {
		createLabel,
		updateLabelAdmin,
		archiveLabel,
		unarchiveLabel,
		deleteLabelIfUnused,
	} = useLabelMutations();

	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState("#3b82f6");
	const [savingId, setSavingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleCreate = async () => {
		if (!newName.trim()) return;
		setError(null);
		try {
			await createLabel(newName.trim(), newColor);
			setNewName("");
		} catch (e) {
			setError((e as Error).message);
		}
	};

	const handleUpdate = async (
		id: Id<"labels">,
		updates: { name?: string; color?: string },
	) => {
		setSavingId(id);
		setError(null);
		try {
			await updateLabelAdmin(id, updates);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setSavingId(null);
		}
	};

	const handleArchiveToggle = async (id: Id<"labels">, archived: boolean) => {
		setSavingId(id);
		setError(null);
		try {
			if (archived) {
				await unarchiveLabel(id);
			} else {
				await archiveLabel(id);
			}
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setSavingId(null);
		}
	};

	const handleDelete = async (id: Id<"labels">) => {
		setSavingId(id);
		setError(null);
		try {
			await deleteLabelIfUnused(id);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setSavingId(null);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<span>Labels</span>
					<span className="text-xs text-muted-foreground">
						Edit, archive &amp; safely delete
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex items-center gap-2">
					<Input
						placeholder="New label name"
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						className="h-8"
					/>
					<Input
						type="color"
						value={newColor}
						onChange={(e) => setNewColor(e.target.value)}
						className="h-8 w-16 p-1"
					/>
					<Button size="sm" onClick={() => void handleCreate()}>
						Add
					</Button>
				</div>

				{error && (
					<div className="text-xs text-destructive wrap-break-word">{error}</div>
				)}

				{isLoading ? (
					<div className="py-6 flex items-center justify-center">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				) : labels.length === 0 ? (
					<div className="py-4 text-sm text-muted-foreground">
						No labels yet. Create one above.
					</div>
				) : (
					<div className="space-y-2 max-h-64 overflow-y-auto pr-1">
						{labels.map((label) => (
							<div
								key={label.id}
								className="flex items-center justify-between rounded border px-2 py-1 text-xs"
							>
								<div className="flex items-center gap-2">
									<span
										className="h-3 w-3 rounded-full border"
										style={{ backgroundColor: label.color }}
									/>
									<Input
										defaultValue={label.name}
										className="h-7 w-28"
										onBlur={(e) =>
											e.target.value !== label.name &&
											void handleUpdate(label.id, {
												name: e.target.value.trim() || label.name,
											})
										}
									/>
									<Input
										type="color"
										defaultValue={label.color}
										className="h-7 w-12 p-0"
										onBlur={(e) =>
											e.target.value !== label.color &&
											void handleUpdate(label.id, { color: e.target.value })
										}
									/>
									{label.archived && (
										<Badge variant="outline" className="text-[10px]">
											Archived
										</Badge>
									)}
									{label.usageCount > 0 && (
										<span className="text-[10px] text-muted-foreground">
											{label.usageCount} in use
										</span>
									)}
								</div>
								<div className="flex items-center gap-1">
									<Button
										size="sm"
										variant="outline"
										className="h-7 px-2 text-[11px]"
										onClick={() =>
											void handleArchiveToggle(label.id, label.archived)
										}
										disabled={savingId === label.id}
									>
										{label.archived ? "Unarchive" : "Archive"}
									</Button>
									<Button
										size="sm"
										variant="outline"
										className="h-7 px-2 text-[11px] text-destructive border-destructive"
										onClick={() => void handleDelete(label.id)}
										disabled={savingId === label.id || label.usageCount > 0}
										title={
											label.usageCount > 0
												? "Cannot delete a label that is still used by tasks"
												: "Delete label"
										}
									>
										Delete
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function PhasesSection() {
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
		setError((e as Error).message);
		}
	};

	const handleUpdatePhase = async (
		phaseId: Id<"phases">,
		updates: { name?: string; description?: string; order?: number; archived?: boolean },
	) => {
		setSavingId(phaseId);
		setError(null);
		try {
			await updatePhase(phaseId, updates);
		} catch (e) {
			setError((e as Error).message);
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
			setError((e as Error).message);
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
																		// Swap order values with the phase above.
																		await Promise.all([
																			updatePhase(phase.id, {
																				order: above.order,
																			}),
																			updatePhase(above.id, {
																				order: phase.order,
																			}),
																		]);
																	} catch (e) {
																		setError((e as Error).message);
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
																if (
																	idx === -1 ||
																	idx === phases.length - 1
																)
																	return;
																const below = phases[idx + 1];
																void (async () => {
																	setSavingId(phase.id);
																	setError(null);
																	try {
																		// Swap order values with the phase below.
																		await Promise.all([
																			updatePhase(phase.id, {
																				order: below.order,
																			}),
																			updatePhase(below.id, {
																				order: phase.order,
																			}),
																		]);
																	} catch (e) {
																		setError((e as Error).message);
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
			id: p.id as Id<"phases">,
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

