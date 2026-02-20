import { Suspense, lazy, useState } from "react";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { TaskModal } from "@/components/tasks/task-modal";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { useCreateModalsStore } from "@/store/create-modals-store";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";
import { AppSidebar } from "./app-sidebar";

const CommandMenu = lazy(() =>
	import("@/components/command-menu").then((module) => ({
		default: module.CommandMenu,
	})),
);

const CompetitionModal = lazy(() =>
	import("@/components/competitions/competition-modal").then((module) => ({
		default: module.CompetitionModal,
	})),
);

export function Layout({ children }: { children: React.ReactNode }) {
	const { commandMenuOpen, setCommandMenuOpen } = useGlobalShortcuts();
	const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
	const { taskOpen, competitionOpen, closeTask, closeCompetition } =
		useCreateModalsStore();

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				{children}
				{commandMenuOpen ? (
					<Suspense fallback={null}>
						<CommandMenu
							open={commandMenuOpen}
							onOpenChange={setCommandMenuOpen}
						/>
					</Suspense>
				) : null}
				<KeyboardShortcutsHelp
					open={keyboardShortcutsOpen}
					onOpenChange={setKeyboardShortcutsOpen}
				/>
				<TaskModal open={taskOpen} onOpenChange={closeTask} />
				{competitionOpen ? (
					<Suspense fallback={null}>
						<CompetitionModal
							open={competitionOpen}
							onOpenChange={closeCompetition}
						/>
					</Suspense>
				) : null}
			</SidebarInset>
		</SidebarProvider>
	);
}
