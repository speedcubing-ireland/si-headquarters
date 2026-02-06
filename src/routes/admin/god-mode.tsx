import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useIsDirector } from "@/hooks/use-convex-data";
import { CheckCircle2, Loader2, Link2Off } from "lucide-react";
import { MembersAndTeamsSection } from "@/components/admin/members-and-teams-section";
import { LabelsSection } from "@/components/admin/labels-section";
import { PhasesSection } from "@/components/admin/phases-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
				<GoogleSheetsSection />
				<PhasesSection />
			</div>
		</div>
	);
}

function GoogleSheetsSection() {
	const connectionStatus = useQuery(
		api.sheetsQueries.getGoogleSheetsConnectionStatus,
	);
	const connected = connectionStatus?.connected ?? false;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{connected ? (
						<CheckCircle2 className="size-4 text-green-600" />
					) : (
						<Link2Off className="size-4 text-muted-foreground" />
					)}
					Google Sheets
				</CardTitle>
				<span className="text-xs text-muted-foreground">
					Used to read schedule data from competition sheets (Events page).
				</span>
			</CardHeader>
			<CardContent className="space-y-2">
				{connected ? (
					<p className="text-sm text-muted-foreground">Account connected.</p>
				) : (
					<>
						<p className="text-sm text-muted-foreground">
							Link via terminal (from repo root):
						</p>
						<code className="block rounded bg-muted px-2 py-1.5 text-xs">
							bun run auth:google-sheets
						</code>
						<p className="text-xs text-muted-foreground">
							Add http://localhost:3847 to Google Cloud Console → Credentials →
							OAuth redirect URIs.
						</p>
					</>
				)}
			</CardContent>
		</Card>
	);
}
