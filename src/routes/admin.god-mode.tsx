import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useIsDirector } from "@/hooks/use-convex-data";
import { Loader2 } from "lucide-react";
import { MembersAndTeamsSection } from "@/components/admin/members-and-teams-section";
import { LabelsSection } from "@/components/admin/labels-section";
import { PhasesSection } from "@/components/admin/phases-section";

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
		// Hide the page from non-directors; send them home.
		return <Navigate to="/" />;
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
				<h1 className="text-sm font-semibold">God Mode</h1>
				<span className="text-xs text-muted-foreground">
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
				<PhasesSection />
			</div>
		</div>
	);
}
