import { useState } from "react";
import { CommandMenu } from "@/components/command-menu";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { TaskModal } from "@/components/tasks/task-modal";
import { CompetitionModal } from "@/components/competitions/competition-modal";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { useCreateModalsStore } from "@/store/create-modals-store";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";
import { AppSidebar } from "./app-sidebar";

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
				<CommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
				<KeyboardShortcutsHelp
					open={keyboardShortcutsOpen}
					onOpenChange={setKeyboardShortcutsOpen}
				/>
				<TaskModal open={taskOpen} onOpenChange={closeTask} />
				<CompetitionModal
					open={competitionOpen}
					onOpenChange={closeCompetition}
				/>
			</SidebarInset>
		</SidebarProvider>
	);
}
