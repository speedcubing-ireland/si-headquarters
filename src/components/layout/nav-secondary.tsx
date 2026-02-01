import { Link } from "@tanstack/react-router";
import {
	Archive,
	Loader,
	type LucideIcon,
	Monitor,
	Moon,
	RotateCcw,
	Sun,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useDataV2 } from "@/data/data-store-v2";
import { useCalendarWeekendOverridesStore } from "@/store/calendar-weekend-overrides-store";
import { useCompetitionsFilterStore } from "@/store/competitions-filter-store";
import { useDisplaySettingsStore } from "@/store/display-settings-store";
import { useSavedViewsStore } from "@/store/saved-views-store";
import { useTasksDisplaySettingsStore } from "@/store/tasks-display-settings-store";
import { useTasksFilterStore } from "@/store/tasks-filter-store";
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

function ClearDemoButton() {
	const handleClearDemo = () => {
		// Reset main data store
		useDataV2.getState().resetDemoData();

		// Reset filter stores
		useTasksFilterStore.getState().clearFilters();
		useCompetitionsFilterStore.getState().clearFilters();

		// Reset display settings stores
		useDisplaySettingsStore.getState().reset();
		useTasksDisplaySettingsStore.getState().reset();

		// Reset saved views store
		useSavedViewsStore.getState().resetAll();

		// Reset calendar overrides
		useCalendarWeekendOverridesStore.getState().clearAll();
	};

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				onClick={handleClearDemo}
				tooltip="Clear all demo data"
				className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
			>
				<RotateCcw className="h-[1.2rem] w-[1.2rem]" />
				<span>Clear Demo</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

const navSecondary = [
	{
		title: "Archived",
		to: "/tasks/archived",
		icon: Archive,
	},
	{
		title: "Activity",
		url: "#",
		icon: Loader,
	},
];

export function NavSecondary({
	...props
}: {} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent>
				<SidebarMenu>
					{navSecondary.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild>
								{"to" in item ? (
									<Link to={item.to}>
										{item.icon && <item.icon />}
										<span>{item.title}</span>
									</Link>
								) : (
									<a href={item.url}>
										{item.icon && <item.icon />}
										<span>{item.title}</span>
									</a>
								)}
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
					<ClearDemoButton />
					<ThemeToggleItem />
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
