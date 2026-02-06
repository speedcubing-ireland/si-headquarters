import { createFileRoute } from "@tanstack/react-router";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AttentionBar } from "@/components/dashboard/attention-bar";
import { MyFocusWidget } from "@/components/dashboard/my-focus-widget";
import { CompetitionHealthWidget } from "@/components/dashboard/competition-health-widget";
import { RecentUpdatesWidget } from "@/components/dashboard/recent-updates-widget";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	return (
		<>
			<header className="flex h-16 shrink-0 items-center gap-2">
				<div className="flex items-center gap-2 px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mr-2 data-[orientation=vertical]:h-4"
					/>
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbPage>Headquarters</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
			</header>
			<div className="flex flex-1 flex-col gap-6 p-4 pt-0">
				<AttentionBar />
				<div className="grid gap-6 md:grid-cols-[3fr_2fr]">
					<MyFocusWidget />
					<CompetitionHealthWidget />
				</div>
				<RecentUpdatesWidget />
			</div>
		</>
	);
}
