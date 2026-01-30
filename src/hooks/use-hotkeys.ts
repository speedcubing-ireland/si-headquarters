"use client";

import * as React from "react";

interface HotkeyConfig {
	key: string;
	handler: () => void;
	enabled?: boolean;
	preventDefault?: boolean;
}

export function useHotkeys(configs: HotkeyConfig[]) {
	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			for (const config of configs) {
				if (!config.enabled) continue;

				const keys = config.key.toLowerCase().split("+");
				const key = keys.pop() || "";
				const needsShift = keys.includes("shift");
				const needsCtrl = keys.includes("ctrl") || keys.includes("cmd");
				const needsAlt = keys.includes("alt");
				const needsMeta = keys.includes("cmd") || keys.includes("meta");

				// Check modifiers
				if (needsShift && !event.shiftKey) continue;
				if (needsCtrl && !(event.ctrlKey || event.metaKey)) continue;
				if (needsAlt && !event.altKey) continue;
				if (needsMeta && !event.metaKey) continue;

				// Check if no extra modifiers are pressed (unless required)
				const hasExtraModifiers =
					(!needsShift && event.shiftKey) ||
					(!needsCtrl && (event.ctrlKey || event.metaKey)) ||
					(!needsAlt && event.altKey);

				if (hasExtraModifiers) continue;

				// Check the main key
				if (event.key.toLowerCase() === key) {
					if (config.preventDefault !== false) {
						event.preventDefault();
					}
					config.handler();
					break; // Only trigger first matching hotkey
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [configs]);
}

// Helper hook for single hotkey
export function useHotkey(
	key: string,
	handler: () => void,
	enabled = true,
	preventDefault = true,
) {
	useHotkeys([{ key, handler, enabled, preventDefault }]);
}
