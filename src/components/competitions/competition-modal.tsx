import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import React from "react";
import { TemplateSelector } from "@/components/template-selector";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
	FormModalHeader,
	FormModalFooter,
} from "@/components/shared/form-modal-layout";
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
}

const CompetitionModalRoot = React.memo(function CompetitionModalRoot({
	open,
	onOpenChange,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[640px] p-0">{children}</DialogContent>
		</Dialog>
	);
});

const CompetitionModalContent = React.memo(function CompetitionModalContent({
	children,
}: {
	children: React.ReactNode;
}) {
	return <div className="px-6 py-4 space-y-4">{children}</div>;
});

const CompetitionModalBasicInfo = React.memo(
	function CompetitionModalBasicInfo({
		name,
		description,
		onNameChange,
		onDescriptionChange,
	}: {
		name: string;
		description: string;
		onNameChange: (value: string) => void;
		onDescriptionChange: (value: string) => void;
	}) {
		return (
			<>
				<Input
					placeholder="Competition name"
					value={name}
					onChange={(e) => onNameChange(e.target.value)}
					className="text-lg font-medium border-0 px-0 focus-visible:ring-0 placeholder:text-muted-foreground"
					autoFocus
				/>
				<div className="space-y-1">
					<span className="text-xs text-muted-foreground">Description</span>
					<Input
						placeholder="Short description (optional)"
						value={description}
						onChange={(e) => onDescriptionChange(e.target.value)}
					/>
				</div>
			</>
		);
	},
);

const CompetitionModalDates = React.memo(function CompetitionModalDates({
	compStart,
	compEnd,
	onCompStartChange,
	onCompEndChange,
}: {
	compStart: Date | undefined;
	compEnd: Date | undefined;
	onCompStartChange: (date: Date | undefined) => void;
	onCompEndChange: (date: Date | undefined) => void;
}) {
	return (
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
							{compStart ? format(compStart, "MMM d, yyyy") : "Select date"}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="start">
						<Calendar
							mode="single"
							selected={compStart}
							onSelect={onCompStartChange}
							autoFocus
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
							onSelect={onCompEndChange}
							autoFocus
						/>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
});

const CompetitionModalRoles = React.memo(function CompetitionModalRoles({
	compLead,
	leadDelegate,
	organisers,
	compLeadOptions,
	leadDelegateOptions,
	users,
	onCompLeadChange,
	onLeadDelegateChange,
	onToggleOrganiser,
	renderUserOption,
}: {
	compLead: User | null;
	leadDelegate: User | null;
	organisers: User[];
	compLeadOptions: User[];
	leadDelegateOptions: User[];
	users: User[];
	onCompLeadChange: (user: User | null) => void;
	onLeadDelegateChange: (user: User | null) => void;
	onToggleOrganiser: (user: User) => void;
	renderUserOption: (user: User) => React.ReactNode;
}) {
	return (
		<>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="space-y-1">
					<span className="text-xs text-muted-foreground">
						Competition lead
					</span>
					<Select
						value={compLead?.id ?? "__unassigned__"}
						onValueChange={(id) => {
							const user =
								id === "__unassigned__"
									? null
									: (compLeadOptions.find((u) => u.id === id) ?? null);
							onCompLeadChange(user);
						}}
					>
						<SelectTrigger className="w-full h-8 gap-2">
							<SelectValue placeholder="Select lead" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__unassigned__">
								<span className="text-xs text-muted-foreground">
									Unassigned
								</span>
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
					<span className="text-xs text-muted-foreground">Lead delegate</span>
					<Select
						value={leadDelegate?.id ?? "__unassigned__"}
						onValueChange={(id) => {
							const user =
								id === "__unassigned__"
									? null
									: (leadDelegateOptions.find((u) => u.id === id) ?? null);
							onLeadDelegateChange(user);
						}}
					>
						<SelectTrigger className="w-full h-8 gap-2">
							<SelectValue placeholder="Select delegate" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__unassigned__">
								<span className="text-xs text-muted-foreground">
									Unassigned
								</span>
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
								onClick={() => onToggleOrganiser(user)}
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
		</>
	);
});

const CompetitionModalPhases = React.memo(function CompetitionModalPhases({
	phases,
	currentPhaseIdx,
	onCurrentPhaseIdxChange,
}: {
	phases: CompetitionPhase[];
	currentPhaseIdx: number;
	onCurrentPhaseIdxChange: (idx: number) => void;
}) {
	return (
		<div className="space-y-1">
			<span className="text-xs text-muted-foreground">Current phase</span>
			<Select
				value={String(currentPhaseIdx)}
				onValueChange={(idx) =>
					onCurrentPhaseIdxChange(Number.parseInt(idx, 10))
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
	);
});

const CompetitionModalSheet = React.memo(function CompetitionModalSheet({
	compSheet,
	onCompSheetChange,
}: {
	compSheet: string;
	onCompSheetChange: (value: string) => void;
}) {
	return (
		<div className="space-y-1">
			<span className="text-xs text-muted-foreground">
				Google Sheet ID (optional)
			</span>
			<Input
				placeholder="Enter Google Sheet ID..."
				value={compSheet}
				onChange={(e) => onCompSheetChange(e.target.value)}
			/>
		</div>
	);
});

function CompetitionModalImpl({ open, onOpenChange }: CompetitionModalProps) {
	const { users } = useUsers();
	const { teams } = useTeams();
	const { addCompetition } = useCompetitionMutations();
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

	const [_showTemplateSelector, _setShowTemplateSelector] = useState(false);
	const [_selectedTemplate, _setSelectedTemplate] =
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

	const initialValues = useMemo(() => {
		if (!open) return null;
		return {
			showTemplateSelector: true,
			selectedTemplate: null as CompetitionTemplate | null,
			name: "",
			description: "",
			compStart: undefined as Date | undefined,
			compEnd: undefined as Date | undefined,
			compLead: null as User | null,
			leadDelegate: null as User | null,
			organisers: [] as User[],
			phases: getBasePhases,
			currentPhaseIdx: 0,
			compSheet: "",
		};
	}, [open, getBasePhases]);

	const [showTemplateSelector, setShowTemplateSelector] = useState(
		initialValues?.showTemplateSelector ?? false,
	);
	const [selectedTemplate, setSelectedTemplate] =
		useState<CompetitionTemplate | null>(
			initialValues?.selectedTemplate ?? null,
		);
	const [name, setName] = useState(initialValues?.name ?? "");
	const [description, setDescription] = useState(
		initialValues?.description ?? "",
	);
	const [compStart, setCompStart] = useState<Date | undefined>(
		initialValues?.compStart,
	);
	const [compEnd, setCompEnd] = useState<Date | undefined>(
		initialValues?.compEnd,
	);
	const [compLead, setCompLead] = useState<User | null>(
		initialValues?.compLead ?? null,
	);
	const [leadDelegate, setLeadDelegate] = useState<User | null>(
		initialValues?.leadDelegate ?? null,
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
		initialValues?.organisers ?? [],
	);
	const [phases, setPhases] = useState<CompetitionPhase[]>(
		initialValues?.phases ?? [],
	);
	const [currentPhaseIdx, setCurrentPhaseIdx] = useState<number>(
		initialValues?.currentPhaseIdx ?? 0,
	);
	const [compSheet, setCompSheet] = useState<string>(
		initialValues?.compSheet ?? "",
	);

	const prevInitialValuesRef = useRef(initialValues);
	useEffect(() => {
		if (initialValues && prevInitialValuesRef.current !== initialValues) {
			setShowTemplateSelector(initialValues.showTemplateSelector);
			setSelectedTemplate(initialValues.selectedTemplate);
			setName(initialValues.name);
			setDescription(initialValues.description);
			setCompStart(initialValues.compStart);
			setCompEnd(initialValues.compEnd);
			setCompLead(initialValues.compLead);
			setLeadDelegate(initialValues.leadDelegate);
			setOrganisers(initialValues.organisers);
			setPhases(initialValues.phases);
			setCurrentPhaseIdx(initialValues.currentPhaseIdx);
			setCompSheet(initialValues.compSheet);
			prevInitialValuesRef.current = initialValues;
		}
	}, [initialValues]);

	const handleTemplateSelect = useCallback(
		(templateId: string) => {
			setShowTemplateSelector(false);

			if (templateId === "") return;

			const template = competitionTemplatesList.find(
				(t) => t.id === templateId,
			);
			if (!template) return;

			setSelectedTemplate(template);

			const today = new Date();
			setName(`${template.name} Competition`);
			setDescription(template.description);
			setCompStart(today);
			setCompEnd(today);
			setPhases(getBasePhases);
			setCurrentPhaseIdx(0);
		},
		[competitionTemplatesList, getBasePhases],
	);

	const toggleOrganiser = useCallback((user: User) => {
		setOrganisers((prev) => {
			const exists = prev.some((o) => o.id === user.id);
			if (exists) {
				return prev.filter((o) => o.id !== user.id);
			}
			return [...prev, user];
		});
	}, []);

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
				phaseName != null ? (phasesByName.get(phaseName) ?? null) : null;

			const getInitialStatus = (
				phaseName: string | null,
			): "to-do" | "backlog" =>
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
			const phasesByName = new Map(competitionPhases.map((p) => [p.name, p]));
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

		const created = await addCompetition(baseData);

		if (selectedTemplate) {
			await createTasksFromTemplate(created.id, selectedTemplate, phases);
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
		addCompetition,
		selectedTemplate,
		createTasksFromTemplate,
		onOpenChange,
	]);

	const renderUserOption = (user: User) => (
		<UserAvatar user={user} size="xs" showName nameClassName="text-sm" />
	);

	const handleCancel = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	if (showTemplateSelector) {
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
		<CompetitionModalRoot open={open} onOpenChange={onOpenChange}>
			<FormModalHeader title="Create competition" />
			<CompetitionModalContent>
				<CompetitionModalBasicInfo
					name={name}
					description={description}
					onNameChange={setName}
					onDescriptionChange={setDescription}
				/>
				<CompetitionModalDates
					compStart={compStart}
					compEnd={compEnd}
					onCompStartChange={setCompStart}
					onCompEndChange={setCompEnd}
				/>
				<CompetitionModalRoles
					compLead={compLead}
					leadDelegate={leadDelegate}
					organisers={organisers}
					compLeadOptions={compLeadOptions}
					leadDelegateOptions={leadDelegateOptions}
					users={users}
					onCompLeadChange={setCompLead}
					onLeadDelegateChange={setLeadDelegate}
					onToggleOrganiser={toggleOrganiser}
					renderUserOption={renderUserOption}
				/>
				<CompetitionModalPhases
					phases={phases}
					currentPhaseIdx={currentPhaseIdx}
					onCurrentPhaseIdxChange={setCurrentPhaseIdx}
				/>
				<CompetitionModalSheet
					compSheet={compSheet}
					onCompSheetChange={setCompSheet}
				/>
			</CompetitionModalContent>
			<FormModalFooter
				mode="create"
				onCancel={handleCancel}
				onSubmit={handleSubmit}
				submitDisabled={!name.trim()}
				createLabel="Create competition"
				saveLabel="Save changes"
			/>
		</CompetitionModalRoot>
	);
}

export const CompetitionModal = Object.assign(CompetitionModalImpl, {
	Root: CompetitionModalRoot,
	Header: FormModalHeader,
	Content: CompetitionModalContent,
	BasicInfo: CompetitionModalBasicInfo,
	Dates: CompetitionModalDates,
	Roles: CompetitionModalRoles,
	Phases: CompetitionModalPhases,
	Sheet: CompetitionModalSheet,
	Footer: FormModalFooter,
});
