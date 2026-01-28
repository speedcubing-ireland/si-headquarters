import { Link } from "@tanstack/react-router";
import {
	Blocks,
	Box,
	CircleCheck,
	ClipboardList,
	Inbox,
	KanbanSquare,
	ListTodo,
} from "lucide-react";
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

const navSections = [
	{
		title: null,
		items: [
			{
				type: "item",
				name: "My Tasks",
				url: ".",
				icon: CircleCheck,
			},
			{
				type: "item",
				name: "Inbox",
				url: ".",
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
						url: ".",
					},
				],
			},
			{
				type: "item",
				name: "Projects",
				url: ".",
				icon: KanbanSquare,
			},
			{
				type: "item",
				name: "Tasks",
				url: ".",
				icon: ListTodo,
			},
			{
				type: "dropdown",
				title: "Saved Views",
				icon: ClipboardList,
				items: [
					{
						title: "Needs Review",
						url: ".",
					},
					{
						title: "Certs",
						url: ".",
					},
					{
						title: "Sponsorship",
						url: ".",
					},
				],
			},
		],
	},
	{
		title: "Teams",
		items: [
			{
				type: "dropdown",
				title: "Competitions",
				items: [
					{
						title: "Tasks",
						url: ".",
					},
					{
						title: "Shared Views",
						url: ".",
					},
				],
			},
			{
				type: "dropdown",
				title: "Social Media",
				items: [
					{
						title: "Tasks",
						url: ".",
					},
					{
						title: "Shared Views",
						url: ".",
					},
				],
			},
			{
				type: "dropdown",
				title: "Merchandise",
				items: [
					{
						title: "Tasks",
						url: ".",
					},
					{
						title: "Shared Views",
						url: ".",
					},
				],
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
				<NavSecondary className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={userData} />
			</SidebarFooter>
		</Sidebar>
	);
}
