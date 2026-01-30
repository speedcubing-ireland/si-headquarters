import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CommandMenu } from "@/components/command-menu";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";
import { AppSidebar } from "./app-sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
	const navigate = useNavigate();
	const { commandMenuOpen, setCommandMenuOpen } = useGlobalShortcuts();
	const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);

	// Handle global navigation events
	useEffect(() => {
		const handler = (e: CustomEvent<{ path: string }>) => {
			navigate({ to: e.detail.path });
		};

		window.addEventListener("navigate-to", handler as EventListener);
		return () =>
			window.removeEventListener("navigate-to", handler as EventListener);
	}, [navigate]);

	// Handle show keyboard shortcuts event
	useEffect(() => {
		const handler = () => {
			setKeyboardShortcutsOpen(true);
		};

		window.addEventListener(
			"show-keyboard-shortcuts",
			handler as EventListener,
		);
		return () =>
			window.removeEventListener(
				"show-keyboard-shortcuts",
				handler as EventListener,
			);
	}, []);

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
			</SidebarInset>
		</SidebarProvider>
	);
}
