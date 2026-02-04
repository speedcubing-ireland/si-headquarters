import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TemplateSelector } from "@/components/template-selector";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	useUsers,
	useTeams,
	useCompetitionMutations,
	useTaskMutations,
	usePhases,
} from "@/hooks/use-convex-data";
import { getCompetitionTemplates, getTeamBySeededName } from "@/data/templates";
import { getRoleSelectUsers } from "@/lib/team-utils";
import type {
	Competition,
	CompetitionPhase,
	CompetitionTemplate,
	TemplateTask,
	User,
} from "@/data/types-new";
import { DEFAULT_PHASES } from "@/data/types-new";
import { cn } from "@/lib/utils";

interface CompetitionModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "create" | "edit";
	competition?: Competition;
	onSave?: (competition: Competition) => void;
}

export function CompetitionModal({
	open,
	onOpenChange,
	mode,
	competition,
	onSave,
}: CompetitionModalProps) {
	const { users } = useUsers();
	const { teams } = useTeams();
	const { addCompetition, updateCompetition } = useCompetitionMutations();
	const { addTask } = useTaskMutations();
	const { phases: globalPhases } = usePhases();
	const competitionTemplatesList = useMemo(
		() => getCompetitionTemplates(teams),
		[teams],
	);

	const competitionsTeam = useMemo(
		() => getTeamBySeededName(teams, "Competitions Team"),
		[teams],
	);
	const delegatesTeam = useMemo(
		() => getTeamBySeededName(teams, "Delegates"),
		[teams],
	);

	const [showTemplateSelector, setShowTemplateSelector] = useState(false);
	const [selectedTemplate, setSelectedTemplate] =
		useState<CompetitionTemplate | null>(null);

	const getBasePhases = useMemo(
		() =>
			globalPhases.length > 0
				? globalPhases
				: DEFAULT_PHASES.map((p, idx) => ({
						id: `${idx}`,
						...p,
					})),
		[globalPhases],
	);

	const [name, setName] = useState(competition?.name ?? "");
	const [description, setDescription] = useState(
		competition?.description ?? "",
	);
	const [compStart, setCompStart] = useState<Date | undefined>(
		competition?.compStart ? new Date(competition.compStart) : undefined,
	);
	const [compEnd, setCompEnd] = useState<Date | undefined>(
		competition?.compEnd ? new Date(competition.compEnd) : undefined,
	);
	const [compLead, setCompLead] = useState<User | null>(
		competition?.compLead ?? null,
	);
	const [leadDelegate, setLeadDelegate] = useState<User | null>(
		competition?.leadDelegate ?? null,
	);

	const compLeadOptions = useMemo(
		() => getRoleSelectUsers(competitionsTeam, compLead),
		[competitionsTeam, compLead],
	);
	const leadDelegateOptions = useMemo(
		() => getRoleSelectUsers(delegatesTeam, leadDelegate),
		[delegatesTeam, leadDelegate],
	);

	const [organisers, setOrganisers] = useState<User[]>(
		competition?.organisers ?? [],
	);
	const [phases, setPhases] = useState<CompetitionPhase[]>(
		competition?.phases ?? globalPhases ?? [],
	);
	const [currentPhaseIdx, setCurrentPhaseIdx] = useState<number>(
		competition?.currentPhaseIdx ?? 0,
	);
	const [compSheet, setCompSheet] = useState<string>(
		competition?.compSheet?.sheetId ?? "",
	);

	useEffect(() => {
		if (!open) return;

		if (mode === "create") {
			setShowTemplateSelector(true);
			setSelectedTemplate(null);
			setName("");
			setDescription("");
			setCompStart(undefined);
			setCompEnd(undefined);
			setCompLead(null);
			setLeadDelegate(null);
			setOrganisers([]);
			setPhases(getBasePhases);
			setCurrentPhaseIdx(0);
			setCompSheet("");
		}
	}, [open, mode, getBasePhases]);

	useEffect(() => {
		if (!open || mode !== "edit" || !competition) return;

		setShowTemplateSelector(false);
		setName(competition.name);
		setDescription(competition.description);
		setCompStart(new Date(competition.compStart));
		setCompEnd(new Date(competition.compEnd));
		setCompLead(competition.compLead);
		setLeadDelegate(competition.leadDelegate);
		setOrganisers(competition.organisers);
		setPhases(competition.phases);
		setCurrentPhaseIdx(competition.currentPhaseIdx);
		setCompSheet(competition.compSheet?.sheetId ?? "");
	}, [open, mode, competition]);

	const handleTemplateSelect = (templateId: string) => {
		setShowTemplateSelector(false);

		if (templateId === "") return;

		const template = competitionTemplatesList.find((t) => t.id === templateId);
		if (!template) return;

		setSelectedTemplate(template);

		const today = new Date();
		setName(`${template.name} Competition`);
		setDescription(template.description);
		setCompStart(today);
		setCompEnd(today);
		setPhases(getBasePhases);
		setCurrentPhaseIdx(0);
	};

	const toggleOrganiser = (user: User) => {
		const exists = organisers.some((o) => o.id === user.id);
		if (exists) {
			setOrganisers(organisers.filter((o) => o.id !== user.id));
		} else {
			setOrganisers([...organisers, user]);
		}
	};

	const resolveOwnerAssignee = useCallback(
		(t: TemplateTask) => {
			let owner: User | { id: string; name: string; members: User[] } | null =
				null;
			if (t.ownerType === "team" && t.ownerId) {
				owner = teams.find((team) => team.id === t.ownerId) ?? null;
			} else if (t.ownerType === "user" && t.ownerId) {
				owner = users.find((u) => u.id === t.ownerId) ?? null;
			}

			let assignee: User | null = null;
			if (t.suggestedAssigneeId) {
				assignee = users.find((u) => u.id === t.suggestedAssigneeId) ?? null;
			} else if (owner && "members" in owner && owner.members?.length) {
				assignee = owner.members[0] ?? null;
			} else if (owner && !("members" in owner)) {
				assignee = owner as User;
			}
			return { owner, assignee };
		},
		[teams, users],
	);

	const resolveRequiredApprovalIds = useCallback(
		(teamNames: string[] | undefined) => {
			if (!teamNames?.length) return undefined;
			return teamNames
				.map((name) => {
					const team = teams.find((t) => t.name === name);
					return team ? `team-${team.id}` : null;
				})
				.filter((id): id is string => id != null);
		},
		[teams],
	);

	const createTaskFromTemplate = useCallback(
		async (
			task: TemplateTask,
			competitionId: string,
			phasesByName: Map<string, CompetitionPhase>,
			firstPhaseName: string | null,
			parentId?: string,
		) => {
			const getPhase = (phaseName: string | null) =>
				phaseName != null ? phasesByName.get(phaseName) ?? null : null;

			const getInitialStatus = (phaseName: string | null): "to-do" | "backlog" =>
				firstPhaseName != null && phaseName === firstPhaseName
					? "to-do"
					: "backlog";

			const { owner, assignee } = resolveOwnerAssignee(task);

			return await addTask({
				parent: parentId
					? { type: "task", linkedId: parentId }
					: { type: "competition", linkedId: competitionId },
				title: task.title,
				description: task.description,
				owner,
				assignee,
				phase: getPhase(task.phase),
				status: getInitialStatus(task.phase),
				priority: task.priority,
				dueDate: null,
				labels: [],
				...(parentId && {
					requiredApprovalIds: resolveRequiredApprovalIds(
						task.requiredApprovalByTeamNames,
					),
					parentCompetitionId: competitionId,
				}),
			});
		},
		[addTask, resolveOwnerAssignee, resolveRequiredApprovalIds],
	);

	const createTasksFromTemplate = useCallback(
		async (
			competitionId: string,
			template: CompetitionTemplate,
			competitionPhases: CompetitionPhase[],
		) => {
			const phasesByName = new Map(
				competitionPhases.map((p) => [p.name, p]),
			);
			const firstPhaseName = competitionPhases[0]?.name ?? null;

			for (const task of template.defaultTasks) {
				if (task.subTasks?.length) {
					const parentResult = await createTaskFromTemplate(
						task,
						competitionId,
						phasesByName,
						firstPhaseName,
					);

					for (const subtask of task.subTasks) {
						await createTaskFromTemplate(
							subtask,
							competitionId,
							phasesByName,
							firstPhaseName,
							parentResult.id,
						);
					}
				} else {
					await createTaskFromTemplate(
						task,
						competitionId,
						phasesByName,
						firstPhaseName,
					);
				}
			}
		},
		[createTaskFromTemplate],
	);

	const handleSubmit = useCallback(async () => {
		if (!name.trim() || !compStart || !compEnd) return;

		const baseData: Omit<
			Competition,
			"id" | "tasks" | "createdAt" | "updatedAt" | "progressUpdates"
		> = {
			name: name.trim(),
			description: description,
			compStart: format(compStart, "yyyy-MM-dd"),
			compEnd: format(compEnd, "yyyy-MM-dd"),
			compLead,
			leadDelegate,
			organisers,
			phases,
			currentPhaseIdx,
			compSheet: compSheet
				? { type: "google-sheet" as const, sheetId: compSheet }
				: null,
		};

		if (mode === "create") {
			const created = await addCompetition(baseData);

			if (selectedTemplate) {
				await createTasksFromTemplate(created.id, selectedTemplate, phases);
			}

			onSave?.(created);
		} else if (competition) {
			await updateCompetition(competition.id, baseData);
			onSave?.({
				...competition,
				...baseData,
			});
		}

		onOpenChange(false);
	}, [
		name,
		compStart,
		compEnd,
		description,
		compLead,
		leadDelegate,
		organisers,
		phases,
		currentPhaseIdx,
		compSheet,
		mode,
		addCompetition,
		selectedTemplate,
		createTasksFromTemplate,
		onSave,
		competition,
		updateCompetition,
		onOpenChange,
	]);

	const renderUserOption = (user: User) => (
		<UserAvatar user={user} size="xs" showName nameClassName="text-sm" />
	);

	// Show TemplateSelector when creating and template selector is active
	if (mode === "create" && showTemplateSelector) {
		return (
			<TemplateSelector
				type="competition"
				open={open}
				onOpenChange={onOpenChange}
				onSelect={handleTemplateSelect}
			/>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[640px] p-0">
				<DialogHeader className="px-6 pt-6 pb-4 border-b">
					<DialogTitle>
						{mode === "create" ? "Create competition" : "Edit competition"}
					</DialogTitle>
				</DialogHeader>

				<div className="px-6 py-4 space-y-4">
					<Input
						placeholder="Competition name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="text-lg font-medium border-0 px-0 focus-visible:ring-0 placeholder:text-muted-foreground"
						autoFocus
					/>

					<div className="space-y-1">
						<span className="text-xs text-muted-foreground">Description</span>
						<Input
							placeholder="Short description (optional)"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-1">
							<span className="text-xs text-muted-foreground">Start date</span>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className={cn(
											"w-full justify-start gap-2",
											!compStart && "text-muted-foreground",
										)}
									>
										<CalendarIcon className="size-4" />
										{compStart
											? format(compStart, "MMM d, yyyy")
											: "Select date"}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={compStart}
										onSelect={setCompStart}
										initialFocus
									/>
								</PopoverContent>
							</Popover>
						</div>

						<div className="space-y-1">
							<span className="text-xs text-muted-foreground">End date</span>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className={cn(
											"w-full justify-start gap-2",
											!compEnd && "text-muted-foreground",
										)}
									>
										<CalendarIcon className="size-4" />
										{compEnd ? format(compEnd, "MMM d, yyyy") : "Select date"}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={compEnd}
										onSelect={setCompEnd}
										initialFocus
									/>
								</PopoverContent>
							</Popover>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-1">
							<span className="text-xs text-muted-foreground">
								Competition lead
							</span>
							<Select
								value={compLead?.id ?? "__unassigned__"}
								onValueChange={(id) => {
									const user = id === "__unassigned__" ? null : compLeadOptions.find((u) => u.id === id) ?? null;
									setCompLead(user);
								}}
							>
								<SelectTrigger className="w-full h-8 gap-2">
									<SelectValue placeholder="Select lead" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__unassigned__">
										<span className="text-xs text-muted-foreground">Unassigned</span>
									</SelectItem>
									{compLeadOptions.map((user) => (
										<SelectItem key={user.id} value={user.id}>
											{renderUserOption(user)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1">
							<span className="text-xs text-muted-foreground">
								Lead delegate
							</span>
							<Select
								value={leadDelegate?.id ?? "__unassigned__"}
								onValueChange={(id) => {
									const user = id === "__unassigned__" ? null : leadDelegateOptions.find((u) => u.id === id) ?? null;
									setLeadDelegate(user);
								}}
							>
								<SelectTrigger className="w-full h-8 gap-2">
									<SelectValue placeholder="Select delegate" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__unassigned__">
										<span className="text-xs text-muted-foreground">Unassigned</span>
									</SelectItem>
									{leadDelegateOptions.map((user) => (
										<SelectItem key={user.id} value={user.id}>
											{renderUserOption(user)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-1">
						<span className="text-xs text-muted-foreground">Organisers</span>
						<div className="flex flex-wrap gap-2">
							{users.map((user) => {
								const isSelected = organisers.some((o) => o.id === user.id);
								return (
									<Button
										key={user.id}
										variant={isSelected ? "secondary" : "outline"}
										size="sm"
										className="gap-2"
										onClick={() => toggleOrganiser(user)}
									>
										<UserAvatar
											user={user}
											size="xs"
											showName
											nameClassName="text-sm"
										/>
									</Button>
								);
							})}
						</div>
					</div>

					<div className="space-y-1">
						<span className="text-xs text-muted-foreground">Current phase</span>
						<Select
							value={String(currentPhaseIdx)}
							onValueChange={(idx) =>
								setCurrentPhaseIdx(Number.parseInt(idx, 10))
							}
						>
							<SelectTrigger className="w-full h-8">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{phases.map((phase, idx) => (
									<SelectItem key={phase.id} value={String(idx)}>
										{phase.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-1">
						<span className="text-xs text-muted-foreground">
							Google Sheet ID (optional)
						</span>
						<Input
							placeholder="Enter Google Sheet ID..."
							value={compSheet}
							onChange={(e) => setCompSheet(e.target.value)}
						/>
					</div>
				</div>

				<div className="px-6 py-4 border-t flex justify-end gap-2">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={!name.trim()}>
						{mode === "create" ? "Create competition" : "Save changes"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
