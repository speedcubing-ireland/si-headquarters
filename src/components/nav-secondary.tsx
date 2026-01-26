import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

type Theme = "light" | "dark" | "system";

const themes: Array<{ value: Theme; label: string; icon: LucideIcon }> = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
];

function ThemeToggleItem() {
	const { theme, setTheme } = useTheme();

	const capitalize = (str: string) =>
		str.charAt(0).toUpperCase() + str.slice(1);

	return (
		<SidebarMenuItem>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<SidebarMenuButton
						tooltip="Toggle theme"
						className="relative data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					>
						<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
						<Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
						<span>{capitalize(theme)}</span>
					</SidebarMenuButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{themes.map(({ value, label, icon: Icon }) => (
						<DropdownMenuItem key={value} onClick={() => setTheme(value)}>
							<Icon className="mr-2 h-4 w-4" />
							<span>{label}</span>
							{theme === value && <span className="ml-auto text-xs">✓</span>}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</SidebarMenuItem>
	);
}

export function NavSecondary({
	...props
}: {} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent>
				<SidebarMenu>
					<ThemeToggleItem />
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
