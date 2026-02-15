import { Check, ChevronRight, FileText, Plus, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import {
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { getCompetitionTemplates } from "@/data/templates";

interface TemplateSelectorProps {
	type: "competition" | "task";
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (templateId: string) => void;
}

export function TemplateSelector({
	type,
	open,
	onOpenChange,
	onSelect,
}: TemplateSelectorProps) {
	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const competitionTemplates = useMemo(() => getCompetitionTemplates(), []);
	const taskTemplates = useMemo(() => [], []);

	const templates =
		type === "competition" ? competitionTemplates : taskTemplates;

	const handleSelect = (templateId: string) => {
		setSelectedId(templateId);
	};

	const handleConfirm = () => {
		if (selectedId) {
			onSelect(selectedId);
			setSelectedId(null);
			setSearch("");
		}
	};

	const handleBlank = () => {
		onSelect("");
		setSelectedId(null);
		setSearch("");
	};

	const filteredTemplates = templates.filter(
		(t) =>
			t.name.toLowerCase().includes(search.toLowerCase()) ||
			t.description.toLowerCase().includes(search.toLowerCase()),
	);

	return (
		<ResponsiveModal
			open={open}
			onOpenChange={onOpenChange}
			dialogContentClassName="max-w-2xl"
			sheetContentClassName="p-6"
		>
			<DialogHeader>
				<DialogTitle>
					{type === "competition" ? "Create Competition" : "Create Task"}
				</DialogTitle>
				<DialogDescription>
					Choose a template or start from scratch
				</DialogDescription>
			</DialogHeader>

			<div className="grid grid-cols-3 gap-4 mt-4">
				<button
					type="button"
					onClick={handleBlank}
					className={`flex flex-col items-center justify-center p-4 border rounded-lg transition-colors text-left ${
						selectedId === "" ? "border-primary bg-primary/5" : "hover:bg-muted"
					}`}
				>
					<div className="size-10 rounded-full bg-muted flex items-center justify-center mb-2">
						<Plus className="size-5" />
					</div>
					<span className="font-medium text-sm">Blank</span>
					<span className="text-xs text-muted-foreground mt-1">
						Start fresh
					</span>
				</button>
				{filteredTemplates.map((template) => (
					<button
						type="button"
						key={template.id}
						onClick={() => handleSelect(template.id)}
						className={`flex flex-col items-start p-4 border rounded-lg transition-colors text-left relative ${
							selectedId === template.id
								? "border-primary bg-primary/5"
								: "hover:bg-muted"
						}`}
					>
						{selectedId === template.id && (
							<div className="absolute top-2 right-2">
								<Check className="size-4 text-primary" />
							</div>
						)}
						<div className="size-10 rounded-full bg-muted flex items-center justify-center mb-2">
							{type === "competition" ? (
								<Trophy className="size-5" />
							) : (
								<FileText className="size-5" />
							)}
						</div>
						<span className="font-medium text-sm">{template.name}</span>
						<span className="text-xs text-muted-foreground mt-1 line-clamp-2">
							{template.description}
						</span>
					</button>
				))}
			</div>

			<div className="flex justify-end gap-2 mt-4">
				<Button variant="ghost" onClick={() => onOpenChange(false)}>
					Cancel
				</Button>
				<Button
					onClick={handleConfirm}
					disabled={!selectedId && selectedId !== ""}
				>
					Continue
					<ChevronRight className="size-4 ml-1" />
				</Button>
			</div>
		</ResponsiveModal>
	);
}
