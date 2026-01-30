import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface KeyboardShortcutsHelpProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const SHORTCUT_GROUPS = [
	{
		name: "Navigation",
		shortcuts: [
			{ key: "Cmd/Ctrl + K", description: "Open command menu" },
			{ key: "G then I", description: "Go to Inbox" },
			{ key: "G then M", description: "Go to My Tasks" },
			{ key: "G then T", description: "Go to All Tasks" },
			{ key: "G then C", description: "Go to Competitions" },
		],
	},
	{
		name: "Actions",
		shortcuts: [
			{ key: "C", description: "Create new task" },
			{ key: "?", description: "Show keyboard shortcuts" },
			{ key: "Esc", description: "Close modal / Clear selection" },
		],
	},
	{
		name: "Task List",
		shortcuts: [
			{ key: "Cmd/Ctrl + A", description: "Select all visible tasks" },
			{ key: "Shift + Click", description: "Select range of tasks" },
			{ key: "Delete", description: "Archive selected tasks" },
		],
	},
	{
		name: "Task Detail",
		shortcuts: [
			{ key: "Enter", description: "Save current edit" },
			{ key: "Escape", description: "Cancel current edit" },
		],
	},
];

export function KeyboardShortcutsHelp({
	open,
	onOpenChange,
}: KeyboardShortcutsHelpProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Keyboard Shortcuts</DialogTitle>
				</DialogHeader>

				<div className="grid gap-6 mt-4">
					{SHORTCUT_GROUPS.map((group) => (
						<div key={group.name}>
							<h3 className="text-sm font-semibold text-muted-foreground mb-3">
								{group.name}
							</h3>
							<div className="space-y-2">
								{group.shortcuts.map((shortcut) => (
									<div
										key={shortcut.key}
										className="flex items-center justify-between py-2 border-b last:border-0"
									>
										<span className="text-sm">{shortcut.description}</span>
										<kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
											{shortcut.key}
										</kbd>
									</div>
								))}
							</div>
						</div>
					))}
				</div>

				<div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
					<p>
						Note: Shortcuts work when not focused on text inputs. Some shortcuts
						may vary based on your operating system.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
