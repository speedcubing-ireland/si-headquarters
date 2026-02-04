import type { LinkProps } from "@tanstack/react-router";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";

const BADGE_MAX_DISPLAY = 99;

type LinkOptions = Omit<LinkProps, "children">;
type NavLinkUrl = LinkOptions | LinkOptions["to"];

function NavLink({
	url,
	children,
	className,
	...props
}: {
	url: NavLinkUrl;
	children: React.ReactNode;
	className?: string;
} & Omit<LinkProps, "to" | "children">) {
	if (typeof url === "string") {
		return (
			<Link to={url} className={className} {...props}>
				{children}
			</Link>
		);
	}
	return (
		<Link {...url} className={className} {...props}>
			{children}
		</Link>
	);
}

export type NavSectionDropdownItem = {
	type: "dropdown";
	title: string;
	icon?: LucideIcon;
	isActive?: boolean;
	items?: {
		title: string;
		url: NavLinkUrl;
	}[];
};

export type NavSectionItem = {
	type: "item";
	name: string;
	url: NavLinkUrl;
	icon?: LucideIcon;
	badge?: number;
};

function NavDropdown(item: NavSectionDropdownItem) {
	return (
		<Collapsible
			key={item.title}
			asChild
			defaultOpen={item.isActive}
			className="group/collapsible"
		>
			<SidebarMenuItem>
				<CollapsibleTrigger asChild>
					<SidebarMenuButton tooltip={item.title}>
						{item.icon && <item.icon />}
						<span>{item.title}</span>
						<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
					</SidebarMenuButton>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenuSub>
						{item.items?.map((subItem) => (
							<SidebarMenuSubItem key={subItem.title}>
								<SidebarMenuSubButton asChild>
									<NavLink url={subItem.url}>
										<span>{subItem.title}</span>
									</NavLink>
								</SidebarMenuSubButton>
							</SidebarMenuSubItem>
						))}
					</SidebarMenuSub>
				</CollapsibleContent>
			</SidebarMenuItem>
		</Collapsible>
	);
}

function NavItem(item: NavSectionItem) {
	const location = useLocation();
	const urlString =
		typeof item.url === "string" ? item.url : (item.url as LinkProps)?.to;
	const isActive = !!urlString && location.pathname === urlString;
	const badgeCount = item.badge ?? 0;
	const showBadge = badgeCount > 0;
	return (
		<SidebarMenuItem key={item.name}>
			<SidebarMenuButton asChild isActive={isActive}>
				<NavLink url={item.url} className="flex items-center gap-2">
					{item.icon && <item.icon />}
					<span className="truncate">{item.name}</span>
					{showBadge && (
						<span className="bg-primary text-primary-foreground ml-auto flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
							{badgeCount > BADGE_MAX_DISPLAY
								? `${BADGE_MAX_DISPLAY}+`
								: badgeCount}
						</span>
					)}
				</NavLink>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

const itemComponents = {
	dropdown: NavDropdown,
	item: NavItem,
} as {
	[key: string]: (
		item: NavSectionDropdownItem | NavSectionItem,
	) => React.ReactElement;
};

export function NavSection({
	title,
	items,
}: {
	title: string | null;
	items: (NavSectionDropdownItem | NavSectionItem)[];
}) {
	return (
		<SidebarGroup>
			{title && <SidebarGroupLabel>{title}</SidebarGroupLabel>}
			<SidebarMenu>
				{items.map((item) => itemComponents[item.type](item))}
			</SidebarMenu>
		</SidebarGroup>
	);
}

export type NavSectionData = ComponentProps<typeof NavSection>;
