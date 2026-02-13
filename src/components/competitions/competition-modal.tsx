import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
import { useCompetitionMutations, useLabels } from "@/hooks/use-convex-data";
import { useCompetitionForm } from "@/hooks/use-competition-form";
import { useTemplateTasks } from "@/hooks/use-template-tasks";
import type { User } from "@/data/types-new";
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
							defaultMonth={compStart ?? new Date()}
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
							defaultMonth={compEnd ?? new Date()}
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
	phases: { id: string; name: string }[];
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
	const { addCompetition } = useCompetitionMutations();
	const { labels } = useLabels();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const {
		users,
		teams,
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
		setName,
		setDescription,
		setCompStart,
		setCompEnd,
		setCompLead,
		setLeadDelegate,
		setCurrentPhaseIdx,
		setCompSheet,
		handleTemplateSelect,
		toggleOrganiser,
	} = useCompetitionForm({ open });

	const { createTasksFromTemplate } = useTemplateTasks(teams, users, labels);

	const handleCompStartChange = useCallback(
		(nextStart: Date | undefined) => {
			setCompStart(nextStart);
			if (!nextStart || !compEnd) return;
			if (compEnd.getTime() < nextStart.getTime()) {
				setCompEnd(nextStart);
			}
		},
		[compEnd, setCompEnd, setCompStart],
	);

	const handleSubmit = useCallback(async () => {
		if (!name.trim() || !compStart || !compEnd || isSubmitting) return;

		setIsSubmitting(true);
		try {
			const baseData: Parameters<typeof addCompetition>[0] = {
				name: name.trim(),
				description,
				compStart: format(compStart, "yyyy-MM-dd"),
				compEnd: format(compEnd, "yyyy-MM-dd"),
				compLead,
				leadDelegate,
				organisers,
				compSheet: compSheet
					? { type: "google-sheet" as const, sheetId: compSheet }
					: null,
				wcaCompetitionId: null,
			};

			const created = await addCompetition(baseData);

			if (selectedTemplate) {
				await createTasksFromTemplate(created.id, selectedTemplate, phases);
			}

			onOpenChange(false);
		} finally {
			setIsSubmitting(false);
		}
	}, [
		name,
		compStart,
		compEnd,
		isSubmitting,
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
		setIsSubmitting,
		onOpenChange,
	]);

	const renderUserOption = useMemo(
		() => (user: User) => (
			<UserAvatar user={user} size="xs" showName nameClassName="text-sm" />
		),
		[],
	);

	const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

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
					onCompStartChange={handleCompStartChange}
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
				submitDisabled={!name.trim() || isSubmitting}
				createLabel="Create competition"
				saveLabel="Save changes"
				isSubmitting={isSubmitting}
				submittingLabel="Creating..."
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
