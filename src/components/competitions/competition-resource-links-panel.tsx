import { FileSpreadsheet, Globe } from "lucide-react";
import { CompetitionAddSheetCard } from "@/components/competitions/competition-add-sheet-card";
import { CompetitionAddWcaCard } from "@/components/competitions/competition-add-wca-card";
import {
	DetailResourceTile,
	DetailSection,
} from "@/components/shared/detail-page";
import type { Competition } from "@/data/types-new";
import { useCompetitionMutations } from "@/hooks/use-convex-data";
import { onMutationError } from "@/lib/utils";

export function CompetitionResourceLinksPanel({
	competition,
	canEdit,
}: {
	competition: Competition;
	canEdit: boolean;
}) {
	const { updateCompetition } = useCompetitionMutations();

	return (
		<DetailSection title="Planning">
			<div className="grid gap-3">
				{competition.compSheet ? (
					<DetailResourceTile
						label={competition.compSheet.title ?? "Google Sheet"}
						description="Google Sheets"
						icon={<FileSpreadsheet className="size-4 text-success" />}
						href={`https://docs.google.com/spreadsheets/d/${competition.compSheet.sheetId}`}
						onRemove={
							canEdit
								? () => {
										void updateCompetition(competition.id, {
											compSheet: null,
										}).catch(onMutationError);
									}
								: undefined
						}
					/>
				) : canEdit ? (
					<CompetitionAddSheetCard competition={competition} />
				) : null}

				{competition.wcaUrl ? (
					<DetailResourceTile
						label={
							competition.wcaCompetitionName ??
							competition.wcaCompetitionId ??
							"WCA competition"
						}
						description="WCA"
						icon={<Globe className="size-4 text-info" />}
						href={competition.wcaUrl}
						onRemove={
							canEdit
								? () => {
										void updateCompetition(competition.id, {
											wcaCompetitionId: null,
											wcaCompetitionName: null,
										}).catch(onMutationError);
									}
								: undefined
						}
					/>
				) : canEdit ? (
					<CompetitionAddWcaCard competition={competition} />
				) : null}
			</div>
		</DetailSection>
	);
}
