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

export type NavSectionDropdownItem = {
	type: "dropdown";
	title: string;
	url: string;
	icon?: LucideIcon;
	isActive?: boolean;
	items?: {
		title: string;
		url: string;
	}[];
};

export type NavSectionItem = {
	type: "item";
	name: string;
	url: string;
	icon?: LucideIcon;
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
									<a href={subItem.url}>
										<span>{subItem.title}</span>
									</a>
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
	return (
		<SidebarMenuItem key={item.name}>
			<SidebarMenuButton asChild>
				<a href={item.url}>
					{item.icon && <item.icon />}
					<span>{item.name}</span>
				</a>
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
