import { useAction, useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Loader2, Mail, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/format-utils";
import { onMutationError } from "@/lib/utils";
import { ConnectionStatusCardContainer } from "@/components/admin/connection-status-card";
import { LabelsSection } from "@/components/admin/labels-section";
import { LinkedActionsSection } from "@/components/admin/linked-actions-section";
import { MembersAndTeamsSection } from "@/components/admin/members-and-teams-section";
import { IncognitoLoginLinksSection } from "@/components/admin/incognito-login-links-section";
import { PhasesSection } from "@/components/admin/phases-section";
import { AppPageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type GodModeTab = "users" | "services" | "data" | "linked-actions" | "email";
type ServiceType = "google" | "wca" | "canva";
type DispatchHealth = FunctionReturnType<
	typeof api.notifications.getDispatchHealth
>;
type DeliveryDiagnostics = FunctionReturnType<
	typeof api.notifications.getEmailDeliveryDiagnostics
>;
type DeadLetter = FunctionReturnType<
	typeof api.notifications.listRecentDeadLetters
>[number];

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
					<TabsList className="grid h-auto grid-cols-2 sm:grid-cols-5">
						<TabsTrigger value="users">Users</TabsTrigger>
						<TabsTrigger value="services">Services</TabsTrigger>
						<TabsTrigger value="data">Data</TabsTrigger>
						<TabsTrigger value="linked-actions">
							Linked Integrations
						</TabsTrigger>
						<TabsTrigger value="email">Email</TabsTrigger>
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
							query={api.services.tokens.getConnectionStatus}
						/>
						<ConnectionStatusCardContainer
							title="WCA (World Cube Association)"
							description="Used to search and link competitions to their WCA page."
							disconnectCommand="bun run auth wca"
							oAuthInstructions="Add http://localhost:3848 to WCA → OAuth Applications → Redirect URI."
							service="wca"
							query={api.services.tokens.getConnectionStatus}
						/>
						<ConnectionStatusCardContainer
							title="Canva"
							description="Used by linked integrations to generate assets from configured templates."
							disconnectCommand="bun run auth canva"
							oAuthInstructions="Add http://127.0.0.1:3849 to Canva Connect OAuth redirect URIs."
							service="canva"
							query={api.services.tokens.getConnectionStatus}
						/>
					</TabsContent>
					<TabsContent value="data" className="mt-0 space-y-4">
						<LabelsSection />
						<PhasesSection />
					</TabsContent>
					<TabsContent value="linked-actions" className="mt-0">
						<LinkedActionsSection />
					</TabsContent>
					<TabsContent value="email" className="mt-0">
						<EmailAdminPanel />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

function ServicesTokenCheckCard() {
	const checkConnections = useAction(api.services.tokens.checkConnections);
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

function EmailAdminPanel() {
	const convex = useConvex();
	const sendTestDigestSeries = useMutation(
		api.notifications.sendTestDigestSeries,
	);
	const [diagnostics, setDiagnostics] = useState<{
		dispatchHealth: DispatchHealth;
		deliveryDiagnostics: DeliveryDiagnostics;
		deadLetters: DeadLetter[];
		refreshedAt: number;
	} | null>(null);
	const [toEmail, setToEmail] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [isRefreshingDiagnostics, setIsRefreshingDiagnostics] = useState(false);
	const dispatchHealth = diagnostics?.dispatchHealth;
	const deliveryDiagnostics = diagnostics?.deliveryDiagnostics;
	const deadLetters = diagnostics?.deadLetters ?? [];

	const handleSendSeries = async () => {
		setIsSending(true);
		try {
			const result = await sendTestDigestSeries({
				toEmail: toEmail.trim() || undefined,
			});
			toast.success(
				`Queued ${result.emailCount} test digest emails to ${result.toEmail}`,
			);
		} catch (error) {
			onMutationError(error);
		} finally {
			setIsSending(false);
		}
	};

	const handleRefreshDiagnostics = async () => {
		setIsRefreshingDiagnostics(true);
		try {
			const [nextDispatchHealth, nextDeliveryDiagnostics, nextDeadLetters] =
				await Promise.all([
					convex.query(api.notifications.getDispatchHealth, {}),
					convex.query(api.notifications.getEmailDeliveryDiagnostics, {}),
					convex.query(api.notifications.listRecentDeadLetters, { limit: 20 }),
				]);
			setDiagnostics({
				dispatchHealth: nextDispatchHealth,
				deliveryDiagnostics: nextDeliveryDiagnostics,
				deadLetters: nextDeadLetters,
				refreshedAt: Date.now(),
			});
		} catch (error) {
			onMutationError(error);
		} finally {
			setIsRefreshingDiagnostics(false);
		}
	};

	return (
		<div className="space-y-4 pb-4">
			<Card className="max-w-2xl">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Mail className="size-4 text-muted-foreground" />
						Send Test Email Series
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Sends three test emails using real notification templates: an
						immediate notification (1 item), an hourly digest (3 items), and a
						3x daily digest (5 items).
					</p>
					<div className="space-y-2">
						<Label htmlFor="digest-test-email">
							Recipient email (optional)
						</Label>
						<Input
							id="digest-test-email"
							type="email"
							value={toEmail}
							onChange={(event) => setToEmail(event.target.value)}
							placeholder="Leave empty to send to your own account email"
						/>
					</div>
					<Button
						onClick={() => void handleSendSeries()}
						disabled={isSending}
						className="w-full sm:w-auto"
					>
						{isSending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Send className="size-4" />
						)}
						Send Test Series
					</Button>
				</CardContent>
			</Card>
			<Card className="max-w-4xl">
				<CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2">
							<TriangleAlert className="size-4 text-muted-foreground" />
							Email Queue Diagnostics
						</CardTitle>
						<p className="text-xs text-muted-foreground">
							Manual snapshot only. This avoids keeping the queue diagnostics
							subscribed while emails are being processed.
						</p>
					</div>
					<Button
						onClick={() => void handleRefreshDiagnostics()}
						disabled={isRefreshingDiagnostics}
						className="w-full sm:w-auto"
					>
						{isRefreshingDiagnostics ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<TriangleAlert className="size-4" />
						)}
						Refresh Diagnostics
					</Button>
				</CardHeader>
				<CardContent className="space-y-4">
					{isRefreshingDiagnostics && !dispatchHealth ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" />
							Loading diagnostics...
						</div>
					) : !dispatchHealth ? (
						<p className="text-sm text-muted-foreground">
							Click refresh to load a diagnostics snapshot.
						</p>
					) : (
						<>
							{diagnostics?.refreshedAt ? (
								<p className="text-xs text-muted-foreground">
									Last refreshed:{" "}
									{new Date(diagnostics.refreshedAt).toLocaleString()}
								</p>
							) : null}
							<div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
								<div className="rounded-md border p-3">
									<p className="text-xs text-muted-foreground">Pending</p>
									<p className="text-lg font-semibold">
										{dispatchHealth.totals.pending}
									</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-xs text-muted-foreground">Sent</p>
									<p className="text-lg font-semibold">
										{dispatchHealth.totals.sent}
									</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-xs text-muted-foreground">Failed</p>
									<p className="text-lg font-semibold">
										{dispatchHealth.totals.failed}
									</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-xs text-muted-foreground">
										Dead letters (24h)
									</p>
									<p className="text-lg font-semibold">
										{dispatchHealth.deadLettersLast24h}
									</p>
								</div>
							</div>
							<div className="rounded-md border p-3">
								<p className="text-xs text-muted-foreground">
									Stale queued emails
								</p>
								<p className="text-lg font-semibold">
									{dispatchHealth.stalePendingCount}
								</p>
							</div>
							{deliveryDiagnostics ? (
								<div className="grid gap-2 text-sm sm:grid-cols-2">
									<div className="rounded-md border p-3">
										<p className="text-xs text-muted-foreground">
											Delivery latency p50
										</p>
										<p className="text-lg font-semibold">
											{deliveryDiagnostics.latencyMs.p50 === null
												? "—"
												: `${Math.round(deliveryDiagnostics.latencyMs.p50 / 1000)}s`}
										</p>
									</div>
									<div className="rounded-md border p-3">
										<p className="text-xs text-muted-foreground">
											Delivery latency p95
										</p>
										<p className="text-lg font-semibold">
											{deliveryDiagnostics.latencyMs.p95 === null
												? "—"
												: `${Math.round(deliveryDiagnostics.latencyMs.p95 / 1000)}s`}
										</p>
									</div>
								</div>
							) : null}
							<div className="space-y-2">
								<p className="text-sm font-medium">By channel</p>
								<div className="grid gap-2 text-xs sm:grid-cols-2">
									{dispatchHealth.byChannel.map(
										(row: {
											channel: string;
											pending: number;
											sent: number;
											skipped: number;
											failed: number;
										}) => (
											<div key={row.channel} className="rounded-md border p-3">
												<p className="mb-2 text-sm font-medium capitalize">
													{row.channel.replace("_", " ")}
												</p>
												<div className="grid grid-cols-2 gap-1 text-muted-foreground">
													<span>Pending: {row.pending}</span>
													<span>Sent: {row.sent}</span>
													<span>Skipped: {row.skipped}</span>
													<span>Failed: {row.failed}</span>
												</div>
											</div>
										),
									)}
								</div>
							</div>
						</>
					)}
				</CardContent>
			</Card>
			<Card className="max-w-4xl">
				<CardHeader>
					<CardTitle>Recent Dead Letters</CardTitle>
				</CardHeader>
				<CardContent>
					{isRefreshingDiagnostics && diagnostics === null ? (
						<p className="text-sm text-muted-foreground">Loading...</p>
					) : diagnostics === null ? (
						<p className="text-sm text-muted-foreground">
							Click refresh diagnostics to load recent dead letters.
						</p>
					) : deadLetters.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No dead letters recorded.
						</p>
					) : (
						<div className="space-y-2">
							{deadLetters.map(
								(item: {
									id: string;
									channel: string;
									eventType?: string;
									failedAt: string;
									error: string;
									attempts: number;
									userName?: string;
									userEmail?: string;
									userId?: string;
								}) => (
									<div key={item.id} className="rounded-md border p-3 text-sm">
										<div className="mb-1 flex flex-wrap items-center gap-2">
											<Badge variant="secondary">{item.channel}</Badge>
											{item.eventType ? (
												<Badge variant="outline">{item.eventType}</Badge>
											) : null}
											<span className="text-xs text-muted-foreground">
												{formatDate(item.failedAt)}
											</span>
										</div>
										<p className="font-medium">{item.error}</p>
										<p className="text-xs text-muted-foreground">
											Attempts: {item.attempts} | User:{" "}
											{item.userName ?? item.userEmail ?? item.userId}
										</p>
									</div>
								),
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
