import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Inbox, Settings2 } from "lucide-react";
import { InboxSettingsPage } from "@/components/inbox/settings/inbox-settings-page";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/inbox/settings")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex flex-1 flex-col">
			<header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4 lg:h-12 lg:flex-nowrap lg:px-6 lg:py-0">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<SidebarTrigger className="shrink-0" />
					<Separator orientation="vertical" className="hidden h-4 sm:block" />
					<Inbox className="size-4 text-muted-foreground" />
					<h1 className="text-sm font-semibold">Inbox settings</h1>
					<Separator
						orientation="vertical"
						className="mx-1 hidden h-4 bg-border sm:block"
					/>
					<p className="hidden text-xs text-muted-foreground sm:block">
						Defaults, channels, overrides, and subscriptions
					</p>
				</div>
				<Button asChild variant="outline" size="sm" className="text-xs">
					<Link to="/inbox">
						<ArrowLeft className="mr-1 size-3.5" />
						Back to Inbox
					</Link>
				</Button>
			</header>
			<div className="flex-1 p-4 lg:p-6">
				<div className="mx-auto w-full max-w-6xl">
					<div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
						<Settings2 className="size-4" />
						<span>Notification configuration</span>
					</div>
					<InboxSettingsPage />
				</div>
			</div>
		</div>
	);
}
