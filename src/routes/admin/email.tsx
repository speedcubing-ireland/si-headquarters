import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Loader2, Mail, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useIsDirector } from "@/hooks/use-convex-data";
import { onMutationError } from "@/lib/utils";

export const Route = createFileRoute("/admin/email")({
	component: AdminEmailPage,
});

function AdminEmailPage() {
	const { isDirector, isLoading: isDirectorLoading } = useIsDirector();
	const sendTestDigestSeries = useMutation(
		api.notifications.sendTestDigestSeries,
	);
	const [toEmail, setToEmail] = useState("");
	const [isSending, setIsSending] = useState(false);

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
			</div>
		</div>
	);
}
