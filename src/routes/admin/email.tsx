import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Loader2, Mail, Send, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import {
	useIsDirector,
	useNotificationDiagnostics,
} from "@/hooks/use-convex-data";
import { formatDate } from "@/lib/format-utils";
import { onMutationError } from "@/lib/utils";

export const Route = createFileRoute("/admin/email")({
	component: AdminEmailPage,
});

function AdminEmailPage() {
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

	return <DirectorEmailAdminContent />;
}

function DirectorEmailAdminContent() {
	const sendTestDigestSeries = useMutation(
		api.notifications.sendTestDigestSeries,
	);
	const {
		dispatchHealth,
		deadLetters,
		isLoading: diagnosticsLoading,
	} = useNotificationDiagnostics();
	const [toEmail, setToEmail] = useState("");
	const [isSending, setIsSending] = useState(false);

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

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4 lg:h-12 lg:flex-nowrap lg:px-6 lg:py-0">
				<SidebarTrigger className="shrink-0" />
				<Separator orientation="vertical" className="hidden h-4 sm:block" />
				<h1 className="text-sm font-semibold">Email Admin</h1>
				<span className="hidden text-xs text-muted-foreground sm:inline">
					Directors-only digest testing
				</span>
			</header>

			<div className="flex flex-1 flex-col gap-4 px-4 lg:px-6">
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
							3× daily digest (5 items).
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
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<TriangleAlert className="size-4 text-muted-foreground" />
							Dispatch Diagnostics
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{diagnosticsLoading || !dispatchHealth ? (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="size-4 animate-spin" />
								Loading diagnostics...
							</div>
						) : (
							<>
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
										Stale pending dispatches
									</p>
									<p className="text-lg font-semibold">
										{dispatchHealth.stalePendingCount}
									</p>
								</div>
								<div className="space-y-2">
									<p className="text-sm font-medium">By channel</p>
									<div className="grid gap-2 text-xs sm:grid-cols-2">
										{dispatchHealth.byChannel.map((row) => (
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
										))}
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
						{diagnosticsLoading ? (
							<p className="text-sm text-muted-foreground">Loading...</p>
						) : deadLetters.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No dead letters recorded.
							</p>
						) : (
							<div className="space-y-2">
								{deadLetters.map((item) => (
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
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
