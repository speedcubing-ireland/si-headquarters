import { useEffect } from "react";

export interface UseKeyboardShortcutOptions {
	/** Key to listen for (e.g., "c", "Escape", "Enter") */
	key: string;
	/** Handler function to call when key is pressed */
	handler: () => void;
	/** Whether the shortcut is enabled (default: true) */
	enabled?: boolean;
	/** Whether to prevent default behavior (default: true) */
	preventDefault?: boolean;
	/** Whether to stop propagation (default: false) */
	stopPropagation?: boolean;
	/** Modifier keys that must be pressed */
	modifiers?: {
		ctrl?: boolean;
		meta?: boolean;
		shift?: boolean;
		alt?: boolean;
	};
	/** Element types to ignore (default: ["INPUT", "TEXTAREA", "SELECT"]) */
	ignoreInputs?: string[];
}

/**
 * Hook for handling keyboard shortcuts with support for modifiers and input filtering.
 *
 * @example
 * ```tsx
 * useKeyboardShortcut({
 *   key: "c",
 *   handler: () => setModalOpen(true),
 *   modifiers: { meta: true }, // Cmd+C
 *   enabled: !hasSelection,
 * });
 * ```
 */
export function useKeyboardShortcut({
	key: targetKey,
	handler,
	enabled = true,
	preventDefault = true,
	stopPropagation = false,
	modifiers,
	ignoreInputs = ["INPUT", "TEXTAREA", "SELECT"],
}: UseKeyboardShortcutOptions) {
	useEffect(() => {
		if (!enabled) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			// Check if target is an input element
			const target = event.target as HTMLElement | null;
			if (target && ignoreInputs.includes(target.tagName)) {
				return;
			}

			// Check key match (case-insensitive for letter keys)
			const keyMatches =
				event.key === targetKey ||
				event.key.toLowerCase() === targetKey.toLowerCase();

			if (!keyMatches) return;

			// Check modifiers
			if (modifiers) {
				if (modifiers.ctrl && !event.ctrlKey) return;
				if (modifiers.meta && !event.metaKey) return;
				if (modifiers.shift && !event.shiftKey) return;
				if (modifiers.alt && !event.altKey) return;

				// Ensure no unexpected modifiers
				if (modifiers.ctrl && event.metaKey) return;
				if (modifiers.meta && event.ctrlKey) return;
			}

			if (preventDefault) {
				event.preventDefault();
			}
			if (stopPropagation) {
				event.stopPropagation();
			}

			handler();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [
		targetKey,
		handler,
		enabled,
		preventDefault,
		stopPropagation,
		modifiers,
		ignoreInputs,
	]);
}
