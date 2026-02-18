import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, Moon, Palette, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { CustomThemeModal } from "@/components/theme/custom-theme-modal";
import { builtInThemes } from "@/lib/theme-constants";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

const customThemes = [
	{ value: "custom-light", label: "Light (Custom)", icon: Sun },
	{ value: "custom-dark", label: "Dark (Custom)", icon: Moon },
	{ value: "custom-system", label: "System (Custom)", icon: Monitor },
] as const;

function ThemeToggleItem() {
	const { theme, setTheme, customTheme } = useTheme();
	const [customModalOpen, setCustomModalOpen] = useState(false);

	const hasCustomTheme = customTheme !== null;

	const themeLabel = (() => {
		const custom = customThemes.find((t) => t.value === theme);
		if (custom) return custom.label;
		const builtIn = builtInThemes.find((t) => t.value === theme);
		if (builtIn) return builtIn.label;
		return theme.charAt(0).toUpperCase() + theme.slice(1);
	})();

	return (
		<>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							tooltip="Toggle theme"
							className="relative data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
							<Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
							<span>{themeLabel}</span>
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{hasCustomTheme && (
							<>
								{customThemes.map(({ value, label, icon: Icon }) => (
									<DropdownMenuItem key={value} onClick={() => setTheme(value)}>
										<Icon className="mr-2 h-4 w-4" />
										<span>{label}</span>
										{theme === value && (
											<span className="ml-auto text-xs">✓</span>
										)}
									</DropdownMenuItem>
								))}
								<DropdownMenuSeparator />
							</>
						)}
						{builtInThemes.map(({ value, label, icon: Icon }) => (
							<DropdownMenuItem key={value} onClick={() => setTheme(value)}>
								<Icon className="mr-2 h-4 w-4" />
								<span>{label}</span>
								{theme === value && <span className="ml-auto text-xs">✓</span>}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => setCustomModalOpen(true)}>
							<Palette className="mr-2 h-4 w-4" />
							<span>Customise...</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
			<CustomThemeModal
				open={customModalOpen}
				onOpenChange={setCustomModalOpen}
			/>
		</>
	);
}

type NavSecondaryItem = {
	title: string;
	to: string;
	icon: React.ComponentType;
};

const baseNavSecondary: NavSecondaryItem[] = [
	{ title: "Archived", to: "/tasks/archived", icon: Archive },
];

export function NavSecondary({
	...props
}: React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
	const navItems: NavSecondaryItem[] = [...baseNavSecondary];

	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent>
				<SidebarMenu>
					{navItems.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild>
								<Link to={item.to}>
									<item.icon />
									<span>{item.title}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
					<ThemeToggleItem />
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
