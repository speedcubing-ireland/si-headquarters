import { Link } from "@tanstack/react-router";
import { Blocks, Box, CircleCheck, Inbox, ListTodo, Users } from "lucide-react";
import { NavSecondary } from "@/components/layout/nav-secondary";
import {
	NavSection,
	type NavSectionData,
} from "@/components/layout/nav-section";
import { NavUser } from "@/components/layout/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useDataV2 } from "@/data/data-store-v2";

const navSections = [
	{
		title: null,
		items: [
			{
				type: "item",
				name: "My Tasks",
				url: { to: "/tasks/my" },
				icon: CircleCheck,
			},
			{
				type: "item",
				name: "Inbox",
				url: { to: "/inbox" },
				icon: Inbox,
			},
		],
	},
	{
		title: "Organisation",
		items: [
			{
				type: "dropdown",
				title: "Competitions",
				icon: Box,
				isActive: true,
				items: [
					{
						title: "Overview",
						url: {
							to: "/competitions",
						},
					},
					{
						title: "Calendar",
						url: {
							to: "/competitions",
						},
					},
				],
			},
			{
				type: "item",
				name: "Tasks",
				url: { to: "/tasks" },
				icon: ListTodo,
			},
		],
	},
] satisfies NavSectionData[];

const userData = {
	name: "Simon Kelly",
	email: "simon.kelly@speedcubingireland.com",
	avatar: "/avatars/shadcn.jpg",
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const teams = useDataV2((state) => state.teams);

	const teamSections: NavSectionData[] =
		teams.length === 0
			? []
			: [
					{
						title: "Teams",
						items: teams.slice(0, 3).map((team) => ({
							type: "dropdown",
							title: team.name,
							icon: Users,
							items: [
								{
									title: "Tasks",
									url: {
										to: "/teams/$teamId",
										params: { teamId: team.id },
									},
								},
							],
						})),
					},
				];

	return (
		<Sidebar variant="inset" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link to="/">
								<div className="bg-sidebar-accent text-sidebar-accent-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
									<Blocks className="size-5" />
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">
										Speedcubing Ireland
									</span>
									<span className="truncate text-xs">Headquarters</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{navSections.map((section) => (
					<NavSection key={section.title} {...section} />
				))}
				{teamSections.map((section) => (
					<NavSection key={section.title} {...section} />
				))}
				<NavSecondary className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={userData} />
			</SidebarFooter>
		</Sidebar>
	);
}
