import { Link } from "@tanstack/react-router";
import { ArrowRight, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RecentUpdatesWidget() {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center gap-2 text-sm font-medium">
					<Inbox className="size-4 text-muted-foreground" />
					Recent Updates
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="py-8 text-center text-sm text-muted-foreground">
					Check your inbox for updates
				</div>
				<Link
					to="/inbox"
					className="mt-4 flex items-center gap-1 border-t pt-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					View inbox
					<ArrowRight className="size-3" />
				</Link>
			</CardContent>
		</Card>
	);
}
