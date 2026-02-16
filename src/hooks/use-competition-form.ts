import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { useUsers, useTeams, usePhases } from "@/hooks/use-convex-data";
import { getCompetitionTemplates, getTeamBySeededName } from "@/data/templates";
import { getRoleSelectUsers } from "@/lib/team-utils";
import { TEAM_NAMES } from "../../convex/lib/constants";
import type {
	CompetitionPhase,
	CompetitionTemplate,
	User,
} from "@/data/types-new";
import { DEFAULT_PHASES } from "@/data/types-new";

interface UseCompetitionFormProps {
	open: boolean;
}

export function useCompetitionForm({ open }: UseCompetitionFormProps) {
	const { users } = useUsers();
	const { teams } = useTeams();
	const { phases: globalPhases } = usePhases();

	const competitionTemplatesList = useMemo(() => getCompetitionTemplates(), []);
	const competitionsTeam = useMemo(
		() => getTeamBySeededName(teams, TEAM_NAMES.COMPETITIONS),
		[teams],
	);
	const delegatesTeam = useMemo(
		() => getTeamBySeededName(teams, TEAM_NAMES.DELEGATES),
		[teams],
	);

	const getBasePhases = useMemo(
		(): CompetitionPhase[] =>
			globalPhases.length > 0
				? globalPhases
				: DEFAULT_PHASES.map((p, idx) => ({
						...p,
						id: `${idx}` as Id<"phases">,
					})),
		[globalPhases],
	);

	const basePhasesRef = useRef(getBasePhases);
	basePhasesRef.current = getBasePhases;

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
			phases: basePhasesRef.current,
			currentPhaseIdx: 0,
			compSheet: "",
		};
	}, [open]);

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
	const [organisers, setOrganisers] = useState<User[]>(
		initialValues?.organisers ?? [],
	);
	const [phases, setPhases] = useState<CompetitionPhase[]>(
		(initialValues?.phases ?? []) as CompetitionPhase[],
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
			setPhases(initialValues.phases as CompetitionPhase[]);
			setCurrentPhaseIdx(initialValues.currentPhaseIdx);
			setCompSheet(initialValues.compSheet);
			prevInitialValuesRef.current = initialValues;
		}
	}, [initialValues]);

	const prevBasePhasesRef = useRef(getBasePhases);
	useEffect(() => {
		if (open && getBasePhases !== prevBasePhasesRef.current) {
			prevBasePhasesRef.current = getBasePhases;
			setPhases(getBasePhases as CompetitionPhase[]);
		}
	}, [open, getBasePhases]);

	const compLeadOptions = useMemo(
		() => getRoleSelectUsers(competitionsTeam, compLead),
		[competitionsTeam, compLead],
	);
	const leadDelegateOptions = useMemo(
		() => getRoleSelectUsers(delegatesTeam, leadDelegate),
		[delegatesTeam, leadDelegate],
	);

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
			setPhases(getBasePhases as CompetitionPhase[]);
			setCurrentPhaseIdx(0);
		},
		[competitionTemplatesList, getBasePhases],
	);

	const toggleOrganiser = useCallback((user: User) => {
		setOrganisers((prev) => {
			const exists = prev.some((o) => o.id === user.id);
			if (exists) return prev.filter((o) => o.id !== user.id);
			return [...prev, user];
		});
	}, []);

	const resetForm = useCallback(() => {
		if (initialValues) {
			setShowTemplateSelector(initialValues.showTemplateSelector);
			setSelectedTemplate(initialValues.selectedTemplate);
			setName(initialValues.name);
			setDescription(initialValues.description);
			setCompStart(initialValues.compStart);
			setCompEnd(initialValues.compEnd);
			setCompLead(initialValues.compLead);
			setLeadDelegate(initialValues.leadDelegate);
			setOrganisers(initialValues.organisers);
			setPhases(initialValues.phases as CompetitionPhase[]);
			setCurrentPhaseIdx(initialValues.currentPhaseIdx);
			setCompSheet(initialValues.compSheet);
		}
	}, [initialValues]);

	return {
		users,
		teams,
		competitionTemplatesList,

		showTemplateSelector,
		selectedTemplate,
		name,
		description,
		compStart,
		compEnd,
		compLead,
		leadDelegate,
		organisers,
		phases,
		currentPhaseIdx,
		compSheet,

		compLeadOptions,
		leadDelegateOptions,

		setShowTemplateSelector,
		setSelectedTemplate,
		setName,
		setDescription,
		setCompStart,
		setCompEnd,
		setCompLead,
		setLeadDelegate,
		setOrganisers,
		setPhases,
		setCurrentPhaseIdx,
		setCompSheet,

		handleTemplateSelect,
		toggleOrganiser,
		resetForm,
	};
}
