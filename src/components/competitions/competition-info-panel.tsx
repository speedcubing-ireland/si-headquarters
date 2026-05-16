import { CalendarDays, Store, Users } from "lucide-react";
import { CompetitionDatesControl } from "@/components/competitions/competition-dates-control";
import {
	EditableCompLeadCell,
	EditableLeadDelegateCell,
	EditableOrganisersCell,
} from "@/components/competitions/editable-phase-and-roles";
import { LeadsDisplay } from "@/components/competitions/leads-display";
import { CompetitionSponsorStatusControl } from "@/components/competitions/competition-sponsor-status-control";
import { DetailInfoRow, DetailSection } from "@/components/shared/detail-page";
import type { Competition } from "@/data/types-new";

export function CompetitionInfoPanel({
	competition,
	canEdit,
}: {
	competition: Competition;
	canEdit: boolean;
}) {
	return (
		<DetailSection title="Details">
			<div className="grid gap-3 sm:grid-cols-2">
				<DetailInfoRow
					label="Dates"
					icon={<CalendarDays className="size-3.5" />}
				>
					<CompetitionDatesControl
						competition={competition}
						canEdit={canEdit}
					/>
				</DetailInfoRow>
				<DetailInfoRow label="Sponsor" icon={<Store className="size-3.5" />}>
					<CompetitionSponsorStatusControl competition={competition} />
				</DetailInfoRow>
				<DetailInfoRow
					label="Competition Lead"
					icon={<Users className="size-3.5" />}
				>
					{canEdit ? (
						<EditableCompLeadCell competition={competition} />
					) : (
						<LeadsDisplay
							leads={competition.compLead ? [competition.compLead] : []}
							variant="summary"
						/>
					)}
				</DetailInfoRow>
				<DetailInfoRow
					label="Lead Delegate"
					icon={<Users className="size-3.5" />}
				>
					{canEdit ? (
						<EditableLeadDelegateCell competition={competition} />
					) : (
						<LeadsDisplay
							leads={competition.leadDelegate ? [competition.leadDelegate] : []}
							variant="summary"
						/>
					)}
				</DetailInfoRow>
				<DetailInfoRow label="Organisers" icon={<Users className="size-3.5" />}>
					{canEdit ? (
						<EditableOrganisersCell competition={competition} />
					) : (
						<LeadsDisplay leads={competition.organisers} variant="summary" />
					)}
				</DetailInfoRow>
			</div>
		</DetailSection>
	);
}
