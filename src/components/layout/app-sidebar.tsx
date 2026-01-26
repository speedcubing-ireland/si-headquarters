import {
	Box,
	CircleCheck,
	ClipboardList,
	Earth,
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

const teamDropdownItems = [
	{
		title: "Tasks",
		url: "#",
	},
	{
		title: "Shared Views",
		url: "#",
	},
];

const navSections = [
	{
		title: null,
		items: [
			{
				type: "item",
				name: "My Tasks",
				url: "#",
				icon: CircleCheck,
			},
			{
				type: "item",
				name: "Inbox",
				url: "#",
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
				url: "#",
				icon: Box,
				isActive: true,
				items: [
					{
						title: "Overview",
						url: "#",
					},
					{
						title: "Calendar",
						url: "#",
					},
				],
			},
			{
				type: "item",
				name: "Projects",
				url: "#",
				icon: KanbanSquare,
			},
			{
				type: "item",
				name: "Tasks",
				url: "#",
				icon: ListTodo,
			},
			{
				type: "dropdown",
				title: "Saved Views",
				url: "#",
				icon: ClipboardList,
				items: [
					{
						title: "Needs Review",
						url: "#",
					},
					{
						title: "Certs",
						url: "#",
					},
					{
						title: "Sponsorship",
						url: "#",
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
				url: "#",
				items: teamDropdownItems,
			},
			{
				type: "dropdown",
				title: "Social Media",
				url: "#",
				items: teamDropdownItems,
			},
			{
				type: "dropdown",
				title: "Merchandise",
				url: "#",
				items: teamDropdownItems,
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
							<a href="/">
								<div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
									<Earth className="size-4" />
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">
										Speedcubing Ireland
									</span>
									<span className="truncate text-xs">Headquarters</span>
								</div>
							</a>
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
