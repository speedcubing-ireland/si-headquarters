import { useAction } from "convex/react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { onMutationError } from "@/lib/utils";
import { ConnectionStatusCardContainer } from "@/components/admin/connection-status-card";
import { DiscordAdminSection } from "@/components/admin/discord-admin-section";
import { IncognitoLoginLinksSection } from "@/components/admin/incognito-login-links-section";
import { LabelsSection } from "@/components/admin/labels-section";
import { LinkedActionsSection } from "@/components/admin/linked-actions-section";
import { MembersAndTeamsSection } from "@/components/admin/members-and-teams-section";
import { PhasesSection } from "@/components/admin/phases-section";
import { AppPageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type GodModeTab = "users" | "services" | "data" | "linked-actions" | "discord";
type ServiceType = "google" | "wca" | "canva";

const SERVICE_LABELS: Record<ServiceType, string> = {
	google: "Google Sheets",
	wca: "WCA (World Cube Association)",
	canva: "Canva",
};

export function GodModeAdminContent({
	defaultTab = "users",
}: {
	defaultTab?: GodModeTab;
}) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<AppPageHeader
				title="God Mode"
				subtitle="Directors-only administration"
			/>
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pt-0 lg:p-6 lg:pt-0">
				<Tabs defaultValue={defaultTab} className="flex flex-1 flex-col gap-4">
					<TabsList className="grid h-auto grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
						<TabsTrigger value="users">Users</TabsTrigger>
						<TabsTrigger value="services">Services</TabsTrigger>
						<TabsTrigger value="data">Data</TabsTrigger>
						<TabsTrigger value="linked-actions">
							Linked Integrations
						</TabsTrigger>
						<TabsTrigger value="discord">Discord</TabsTrigger>
					</TabsList>
					<TabsContent value="users" className="mt-0 space-y-4">
						<MembersAndTeamsSection />
						<IncognitoLoginLinksSection />
					</TabsContent>
					<TabsContent value="services" className="mt-0 space-y-4">
						<ServicesTokenCheckCard />
						<ConnectionStatusCardContainer
							title="Google Sheets"
							description="Used to read schedule data from competition sheets (Events page)."
							disconnectCommand="bun run auth google-sheets"
							oAuthInstructions="Add http://localhost:3847 to Google Cloud Console → Credentials → OAuth redirect URIs."
							service="google"
							query={api.integrations.tokens.getConnectionStatus}
						/>
						<ConnectionStatusCardContainer
							title="WCA (World Cube Association)"
							description="Used to search and link competitions to their WCA page."
							disconnectCommand="bun run auth wca"
							oAuthInstructions="Add http://localhost:3848 to WCA → OAuth Applications → Redirect URI."
							service="wca"
							query={api.integrations.tokens.getConnectionStatus}
						/>
						<ConnectionStatusCardContainer
							title="Canva"
							description="Used by linked integrations to generate assets from configured templates."
							disconnectCommand="bun run auth canva"
							oAuthInstructions="Add http://127.0.0.1:3849 to Canva Connect OAuth redirect URIs."
							service="canva"
							query={api.integrations.tokens.getConnectionStatus}
						/>
					</TabsContent>
					<TabsContent value="data" className="mt-0 space-y-4">
						<LabelsSection />
						<PhasesSection />
					</TabsContent>
					<TabsContent value="linked-actions" className="mt-0">
						<LinkedActionsSection />
					</TabsContent>
					<TabsContent value="discord" className="mt-0">
						<DiscordAdminSection />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

function ServicesTokenCheckCard() {
	const checkConnections = useAction(api.integrations.tokens.checkConnections);
	const [isChecking, setIsChecking] = useState(false);
	const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
	const [lastResults, setLastResults] = useState<
		Array<{
			service: ServiceType;
			status: "valid" | "invalid" | "missing";
			message: string;
		}>
	>([]);

	const handleCheckConnections = () => {
		setIsChecking(true);
		void checkConnections({})
			.then((result) => {
				setLastCheckedAt(result.checkedAt);
				setLastResults(result.results);
				const invalidResults = result.results.filter(
					(row) => row.status === "invalid",
				);
				if (invalidResults.length === 0) {
					toast.success("Service token check complete.");
					return;
				}
				toast.error(
					`Reconnect required for: ${invalidResults
						.map((row) => SERVICE_LABELS[row.service])
						.join(", ")}`,
				);
			})
			.catch(onMutationError)
			.finally(() => setIsChecking(false));
	};

	return (
		<Card>
			<CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<CardTitle className="flex items-center gap-2">
						<ShieldCheck className="size-4 text-muted-foreground" />
						Service Token Health Check
					</CardTitle>
					<p className="text-xs text-muted-foreground">
						Refreshes each saved token once to verify service access is still
						valid.
					</p>
				</div>
				<Button
					onClick={handleCheckConnections}
					disabled={isChecking}
					className="w-full sm:w-auto"
				>
					{isChecking ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<ShieldCheck className="size-4" />
					)}
					Check
				</Button>
			</CardHeader>
			{lastResults.length > 0 ? (
				<CardContent className="space-y-3 pt-0">
					{lastCheckedAt ? (
						<p className="text-xs text-muted-foreground">
							Last checked: {new Date(lastCheckedAt).toLocaleString()}
						</p>
					) : null}
					<div className="grid gap-2 lg:grid-cols-3">
						{lastResults.map((row) => (
							<div key={row.service} className="rounded-md border p-3">
								<div className="flex items-center justify-between gap-2">
									<p className="text-sm font-medium">
										{SERVICE_LABELS[row.service]}
									</p>
									<Badge
										variant={
											row.status === "valid"
												? "secondary"
												: row.status === "missing"
													? "outline"
													: "destructive"
										}
										className="whitespace-nowrap"
									>
										{row.status === "valid"
											? "Valid"
											: row.status === "missing"
												? "Not linked"
												: "Reconnect"}
									</Badge>
								</div>
								<p className="mt-1 text-xs text-muted-foreground">
									{row.message}
								</p>
							</div>
						))}
					</div>
				</CardContent>
			) : null}
		</Card>
	);
}
