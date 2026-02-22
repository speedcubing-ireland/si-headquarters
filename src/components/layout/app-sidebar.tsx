import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Blocks, Box, CircleCheck, Inbox, ListTodo, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { NavSecondary } from "@/components/layout/nav-secondary";
import { SIDEBAR_DASHBOARD_ITEMS } from "@/lib/route-permissions";
import {
	NavSection,
	type NavSectionData,
	type NavSectionItem,
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
import {
	usePermissionSnapshot,
	useTeams,
	useUnreadCount,
} from "@/hooks/use-convex-data";
import { isSponsorshipEnabled } from "@/lib/feature-flags";
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";

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
							to: "/competitions/calendar",
						},
					},
					{
						title: "Events",
						url: {
							to: "/events",
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const userResult = useQuery(api.users.getCurrentUser);
	const { data: user } = useRetainedQueryResult(userResult);
	const { permissions } = usePermissionSnapshot();
	const isVolunteer = permissions.isVolunteer;
	const { teams } = useTeams();
	const unreadCount = useUnreadCount();

	const navSectionsWithBadge: NavSectionData[] = navSections.map(
		(section, i) => {
			if (i === 0) {
				return {
					...section,
					items: section.items.map((item) =>
						item.type === "item" && item.name === "Inbox"
							? { ...item, badge: unreadCount ?? 0 }
							: item,
					),
				};
			}
			if (section.title === "Organisation") {
				return {
					...section,
					items: section.items.map((item) => {
						if (
							item.type === "dropdown" &&
							item.title === "Competitions" &&
							item.items
						) {
							const items = isVolunteer
								? item.items
								: item.items.filter((sub) => sub.title !== "Events");
							return { ...item, items };
						}
						return item;
					}),
				};
			}
			return section;
		},
	);

	const myTeams =
		user == null
			? []
			: teams.filter((team) =>
					team.members.some((member) => member.id === user._id),
				);

	const teamSections: NavSectionData[] =
		myTeams.length === 0
			? []
			: [
					{
						title: "Teams",
						items: myTeams.map((team) => ({
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
	const dashboardItems: NavSectionItem[] = [];
	for (const item of SIDEBAR_DASHBOARD_ITEMS) {
		const hasPermission =
			permissions[item.permission] ||
			(item.orPermissions?.some((p) => permissions[p]) ?? false);
		const show =
			hasPermission &&
			(item.path !== "/admin/sponsorship" || isSponsorshipEnabled);
		if (show) {
			dashboardItems.push({
				type: "item",
				name: item.name,
				url: { to: item.path },
				icon: item.icon,
			});
		}
	}
	const dashboardSections: NavSectionData[] =
		dashboardItems.length === 0
			? []
			: [
					{
						title: "Dashboard",
						items: dashboardItems,
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
				{navSectionsWithBadge.map((section, index) => (
					<NavSection
						key={`${section.title ?? "primary"}-${index}`}
						{...section}
					/>
				))}
				{dashboardSections.map((section, index) => (
					<NavSection
						key={`${section.title ?? "dashboard"}-${index}`}
						{...section}
					/>
				))}
				{teamSections.map((section, index) => (
					<NavSection
						key={`${section.title ?? "teams"}-${index}`}
						{...section}
					/>
				))}
			</SidebarContent>
			<SidebarFooter className="flex flex-col gap-0">
				<NavSecondary className="pt-0" />
				<NavUser
					user={
						user
							? {
									name: user.name ?? user.email ?? "User",
									email: user.email ?? "",
									avatar: user.image ?? "",
								}
							: null
					}
				/>
			</SidebarFooter>
		</Sidebar>
	);
}
