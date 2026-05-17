import { useState } from "react";
import { Loader2, Send, TestTube } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { onMutationError } from "@/lib/utils";

export function NotificationTestSection() {
	const sendAll = useMutation(
		api.notifications.testNotifications.sendAllTestNotifications,
	);
	const [isSending, setIsSending] = useState(false);
	const [results, setResults] = useState<string[] | null>(null);

	const handleSend = () => {
		setIsSending(true);
		setResults(null);
		void sendAll({})
			.then((r) => {
				setResults(r);
				const failed = r.filter((line) => line.includes("failed"));
				if (failed.length === 0) {
					toast.success("All test notifications sent.");
				} else {
					toast.error(`${failed.length} notification(s) failed.`);
				}
			})
			.catch(onMutationError)
			.finally(() => setIsSending(false));
	};

	return (
		<Card>
			<CardHeader className="gap-3">
				<CardTitle className="flex items-center gap-2">
					<TestTube className="size-4 text-muted-foreground" />
					Notification Test
				</CardTitle>
				<p className="text-xs text-muted-foreground">
					Send one of each notification type to your account. Useful for
					verifying Discord DM and channel notification delivery.
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				<Button
					type="button"
					onClick={handleSend}
					disabled={isSending}
					className="gap-2"
				>
					{isSending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Send className="size-4" />
					)}
					Send all test notifications
				</Button>

				{results && (
					<div className="space-y-1 rounded-md border bg-muted/30 p-3 font-mono text-xs">
						{results.map((line) => {
							const failed = line.includes("failed");
							return (
								<div key={line} className="flex items-center gap-2">
									<Badge
										variant={failed ? "destructive" : "secondary"}
										className="shrink-0 text-[10px]"
									>
										{failed ? "FAIL" : "OK"}
									</Badge>
									<span className="truncate">{line}</span>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
