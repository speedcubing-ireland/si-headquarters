import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { Competition } from "@/data/types-new";
import { useCompetitionMutations } from "@/hooks/use-convex-data";
import { formatDate } from "@/lib/format-utils";
import { onMutationError } from "@/lib/utils";

function formatLocalDateForStorage(date: Date): string {
	return format(date, "yyyy-MM-dd");
}

export function CompetitionDatesControl({
	competition,
	canEdit,
}: {
	competition: Competition;
	canEdit: boolean;
}) {
	const { updateCompetition } = useCompetitionMutations();
	const [dateOpen, setDateOpen] = useState(false);
	const [dateDraft, setDateDraft] = useState<DateRange | undefined>({
		from: new Date(competition.compStart),
		to: new Date(competition.compEnd),
	});

	const resetDateDraft = useCallback(() => {
		setDateDraft({
			from: new Date(competition.compStart),
			to: new Date(competition.compEnd),
		});
	}, [competition.compEnd, competition.compStart]);

	useEffect(() => {
		if (dateOpen) return;
		resetDateDraft();
	}, [dateOpen, resetDateDraft]);

	const handleSaveDateRange = useCallback(() => {
		if (!dateDraft?.from || !dateDraft.to) return;
		const compStart = formatLocalDateForStorage(dateDraft.from);
		const compEnd = formatLocalDateForStorage(dateDraft.to);
		if (
			compStart !== competition.compStart ||
			compEnd !== competition.compEnd
		) {
			void updateCompetition(competition.id, {
				compStart,
				compEnd,
			}).catch(onMutationError);
		}
		setDateOpen(false);
	}, [
		competition.compEnd,
		competition.compStart,
		competition.id,
		dateDraft?.from,
		dateDraft?.to,
		updateCompetition,
	]);

	if (!canEdit) {
		return (
			<div className="text-sm font-medium">
				{formatDate(competition.compStart)} - {formatDate(competition.compEnd)}
			</div>
		);
	}

	return (
		<Popover
			open={dateOpen}
			onOpenChange={(open) => {
				setDateOpen(open);
				if (!open) resetDateDraft();
			}}
		>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="w-full justify-start font-normal"
				>
					{formatDate(competition.compStart)} -{" "}
					{formatDate(competition.compEnd)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="range"
					required={false}
					selected={dateDraft}
					defaultMonth={dateDraft?.from ?? new Date(competition.compStart)}
					onSelect={setDateDraft}
					numberOfMonths={1}
				/>
				<div className="flex items-center justify-end gap-2 border-t p-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							resetDateDraft();
							setDateOpen(false);
						}}
					>
						Cancel
					</Button>
					<Button
						size="sm"
						disabled={!dateDraft?.from || !dateDraft.to}
						onClick={handleSaveDateRange}
					>
						Save
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
