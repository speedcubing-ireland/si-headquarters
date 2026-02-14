import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	Blocks,
	Box,
	CircleCheck,
	Inbox,
	ListTodo,
	Shield,
	Store,
	Users,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { NavSecondary } from "@/components/layout/nav-secondary";
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
	useIsDirector,
	useIsSponsorshipManager,
	useTeams,
	useUnreadCount,
} from "@/hooks/use-convex-data";
import { isSponsorshipEnabled } from "@/lib/feature-flags";

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
	const user = useQuery(api.users.getCurrentUser);
	const isVolunteer = useQuery(api.auth.isVolunteerQuery) ?? false;
	const { isDirector } = useIsDirector();
	const { isManager: isSponsorshipManager } = useIsSponsorshipManager();
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
	if (isSponsorshipManager && isSponsorshipEnabled) {
		dashboardItems.push({
			type: "item",
			name: "Sponsorship",
			url: { to: "/admin/sponsorship" as const },
			icon: Store,
		});
	}
	if (isDirector) {
		dashboardItems.push({
			type: "item",
			name: "God Mode",
			url: { to: "/admin/god-mode" as const },
			icon: Shield,
		});
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
				<NavSecondary className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
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
