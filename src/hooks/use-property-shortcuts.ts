"use client";

import * as React from "react";

import { useHotkeys } from "@/hooks/use-hotkeys";

interface ShortcutConfig {
	key: string;
	handler: () => void;
	description: string;
}

interface UsePropertyShortcutsProps {
	onStatus?: () => void;
	onPriority?: () => void;
	onAssignee?: () => void;
	onLabels?: () => void;
	onDueDate?: () => void;
	onOwner?: () => void;
	onPhase?: () => void;
	onBlockedBy?: () => void;
	enabled?: boolean;
}

export function usePropertyShortcuts({
	onStatus,
	onPriority,
	onAssignee,
	onLabels,
	onDueDate,
	onOwner,
	onPhase,
	onBlockedBy,
	enabled = true,
}: UsePropertyShortcutsProps) {
	const shortcuts: ShortcutConfig[] = React.useMemo(
		() => [
			...(onStatus
				? [{ key: "s", handler: onStatus, description: "Change status" }]
				: []),
			...(onPriority
				? [{ key: "p", handler: onPriority, description: "Change priority" }]
				: []),
			...(onAssignee
				? [{ key: "a", handler: onAssignee, description: "Change assignee" }]
				: []),
			...(onLabels
				? [{ key: "l", handler: onLabels, description: "Change labels" }]
				: []),
			...(onDueDate
				? [{ key: "Shift+d", handler: onDueDate, description: "Set due date" }]
				: []),
			...(onOwner
				? [{ key: "o", handler: onOwner, description: "Change owner" }]
				: []),
			...(onPhase
				? [{ key: "g", handler: onPhase, description: "Change phase" }]
				: []),
			...(onBlockedBy
				? [{ key: "b", handler: onBlockedBy, description: "Add blocked by" }]
				: []),
		],
		[
			onStatus,
			onPriority,
			onAssignee,
			onLabels,
			onDueDate,
			onOwner,
			onPhase,
			onBlockedBy,
		],
	);

	useHotkeys(
		shortcuts.map((s) => ({
			key: s.key,
			handler: s.handler,
			enabled,
		})),
	);

	return shortcuts;
}

// Hook for showing shortcut hints
export function useShortcutHints() {
	const [showHints, setShowHints] = React.useState(false);

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
				e.preventDefault();
				setShowHints((prev) => !prev);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	return { showHints, setShowHints };
}
