import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useIsDirector } from "@/hooks/use-convex-data";
import { MembersAndTeamsSection } from "@/components/admin/members-and-teams-section";
import { LabelsSection } from "@/components/admin/labels-section";
import { PhasesSection } from "@/components/admin/phases-section";
import { ConnectionStatusCardContainer } from "@/components/admin/connection-status-card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/admin/god-mode")({
	component: GodModePage,
});

function GodModePage() {
	const { isDirector, isLoading: isDirectorLoading } = useIsDirector();

	if (isDirectorLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!isDirector) {
		return <Navigate to="/" />;
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4 lg:h-12 lg:flex-nowrap lg:px-6 lg:py-0">
				<SidebarTrigger className="shrink-0" />
				<Separator orientation="vertical" className="hidden h-4 sm:block" />
				<h1 className="text-sm font-semibold">God Mode</h1>
				<span className="hidden text-xs text-muted-foreground sm:inline">
					Directors-only data management
				</span>
			</header>

			<div className="flex flex-1 flex-col gap-4 px-4 lg:px-6">
				<div className="grid gap-4 lg:grid-cols-3">
					<div className="lg:col-span-2">
						<MembersAndTeamsSection />
					</div>
					<div className="lg:col-span-1">
						<LabelsSection />
					</div>
				</div>
				<ConnectionStatusCardContainer
					title="Google Sheets"
					description="Used to read schedule data from competition sheets (Events page)."
					disconnectCommand="bun run auth:google-sheets"
					oAuthInstructions="Add http://localhost:3847 to Google Cloud Console → Credentials → OAuth redirect URIs."
					query={api.sheetsQueries.getGoogleSheetsConnectionStatus}
				/>
				<ConnectionStatusCardContainer
					title="WCA (World Cube Association)"
					description="Used to search and link competitions to their WCA page."
					disconnectCommand="bun run auth:wca"
					oAuthInstructions="Add http://localhost:3848 to WCA → OAuth Applications → Redirect URI."
					query={api.wcaQueries.getWcaConnectionStatus}
				/>
				<PhasesSection />
			</div>
		</div>
	);
}
