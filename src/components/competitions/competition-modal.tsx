import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
import { useDataV2 } from "@/data/data-store-v2";
import type { Competition, CompetitionPhase, User } from "@/data/types-new";
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
	const users = useDataV2((state) => state.users);
	const addCompetition = useDataV2((state) => state.addCompetition);
	const updateCompetition = useDataV2((state) => state.updateCompetition);
	const createCompetitionFromTemplate = useDataV2(
		(state) => state.createCompetitionFromTemplate,
	);

	const [showTemplateSelector, setShowTemplateSelector] = useState(false);

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
	const [organisers, setOrganisers] = useState<User[]>(
		competition?.organisers ?? [],
	);
	const [phases, setPhases] = useState<CompetitionPhase[]>(
		competition?.phases ??
			DEFAULT_PHASES.map((p, idx) => ({
				id: `${idx}`,
				...p,
			})),
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
			setName("");
			setDescription("");
			setCompStart(undefined);
			setCompEnd(undefined);
			setCompLead(null);
			setLeadDelegate(null);
			setOrganisers([]);
			const basePhases = DEFAULT_PHASES.map((p, idx) => ({
				id: `${idx}`,
				...p,
			}));
			setPhases(basePhases);
			setCurrentPhaseIdx(0);
			setCompSheet("");
		} else if (competition) {
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
		}
	}, [open, mode, competition]);

	const handleTemplateSelect = (templateId: string) => {
		setShowTemplateSelector(false);

		if (templateId === "") {
			// Blank template - proceed to normal form
			return;
		}

		// Valid template - create competition from template
		const created = createCompetitionFromTemplate(templateId, {});
		onSave?.(created);
		onOpenChange(false);
	};

	const toggleOrganiser = (user: User) => {
		const exists = organisers.some((o) => o.id === user.id);
		if (exists) {
			setOrganisers(organisers.filter((o) => o.id !== user.id));
		} else {
			setOrganisers([...organisers, user]);
		}
	};

	const handleSubmit = () => {
		if (!name.trim()) return;
		if (!compStart || !compEnd) return;

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
			const created = addCompetition(baseData);
			onSave?.(created);
		} else if (competition) {
			updateCompetition(competition.id, baseData);
			onSave?.({
				...competition,
				...baseData,
			});
		}

		onOpenChange(false);
	};

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
								value={compLead?.id ?? ""}
								onValueChange={(id) => {
									const user = users.find((u) => u.id === id) ?? null;
									setCompLead(user);
								}}
							>
								<SelectTrigger className="w-full h-8 gap-2">
									<SelectValue placeholder="Select lead" />
								</SelectTrigger>
								<SelectContent>
									{users.map((user) => (
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
								value={leadDelegate?.id ?? ""}
								onValueChange={(id) => {
									const user = users.find((u) => u.id === id) ?? null;
									setLeadDelegate(user);
								}}
							>
								<SelectTrigger className="w-full h-8 gap-2">
									<SelectValue placeholder="Select delegate" />
								</SelectTrigger>
								<SelectContent>
									{users.map((user) => (
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
