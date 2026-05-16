import { useAction } from "convex/react";
import { FileSpreadsheet } from "lucide-react";
import { useCallback, useState } from "react";
import { parseGoogleSheetId } from "@/components/competitions/competition-detail-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import type { Competition } from "@/data/types-new";
import { useCompetitionMutations } from "@/hooks/use-convex-data";
import { onMutationError } from "@/lib/utils";

export function CompetitionAddSheetCard({
	competition,
}: {
	competition: Competition;
}) {
	const { updateCompetition } = useCompetitionMutations();
	const fetchSheetTitle = useAction(
		api.integrations.google.sheets.fetchSheetTitle,
	);
	const [sheetInput, setSheetInput] = useState("");
	const [sheetPopoverOpen, setSheetPopoverOpen] = useState(false);

	const handleAddSheet = useCallback(
		async (sheetId: string) => {
			let title: string | null = null;
			try {
				title = await fetchSheetTitle({ sheetId });
			} catch (error) {
				console.warn("Failed to fetch sheet title before linking.", {
					sheetId,
					error,
				});
			}
			try {
				await updateCompetition(competition.id, {
					compSheet: {
						type: "google-sheet",
						sheetId,
						title: title ?? undefined,
					},
				});
			} catch (error) {
				onMutationError(error);
				return;
			}
			setSheetInput("");
			setSheetPopoverOpen(false);
		},
		[competition.id, fetchSheetTitle, updateCompetition],
	);

	return (
		<div className="rounded-md border border-dashed bg-muted/15 p-3">
			<div className="flex items-start gap-3">
				<div className="rounded-md border bg-background p-2">
					<FileSpreadsheet className="size-4 text-success" />
				</div>
				<div className="min-w-0 flex-1 pt-1 font-medium">Planning sheet</div>
			</div>
			<Popover
				open={sheetPopoverOpen}
				onOpenChange={(open) => {
					setSheetPopoverOpen(open);
					if (!open) setSheetInput("");
				}}
			>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="mt-3">
						Add sheet
					</Button>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className="w-[min(20rem,calc(100vw-1.5rem))] p-3"
				>
					<PopoverHeader className="p-0 pb-2">
						<PopoverTitle className="text-xs font-medium">
							Paste a sheet link or ID
						</PopoverTitle>
					</PopoverHeader>
					<div className="flex gap-2">
						<Input
							placeholder="Paste link or ID..."
							value={sheetInput}
							onChange={(e) => setSheetInput(e.target.value)}
							className="h-9 flex-1"
						/>
						<Button
							size="sm"
							disabled={!parseGoogleSheetId(sheetInput)}
							onClick={() => {
								const sheetId = parseGoogleSheetId(sheetInput);
								if (!sheetId) return;
								void handleAddSheet(sheetId);
							}}
						>
							Add
						</Button>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
