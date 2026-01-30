import { useEffect, useState } from "react";

export function useGlobalShortcuts() {
	const [commandMenuOpen, setCommandMenuOpen] = useState(false);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const isInput =
				target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

			// Cmd/Ctrl + K - Toggle command menu
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setCommandMenuOpen((prev) => !prev);
				return;
			}

			// Don't process other shortcuts when in input fields
			if (isInput) return;

			// C - Create task
			if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) {
				e.preventDefault();
				window.dispatchEvent(new CustomEvent("create-task-shortcut"));
				return;
			}

			// ? - Show keyboard shortcuts help
			if (e.key === "?") {
				e.preventDefault();
				window.dispatchEvent(new CustomEvent("show-keyboard-shortcuts"));
				return;
			}

			// G + navigation shortcuts
			if (e.key.toLowerCase() === "g") {
				// Wait for next key
				const handleNextKey = (nextEvent: KeyboardEvent) => {
					window.removeEventListener("keydown", handleNextKey);

					switch (nextEvent.key.toLowerCase()) {
						case "i": // Go to Inbox
							nextEvent.preventDefault();
							window.dispatchEvent(
								new CustomEvent("navigate-to", { detail: { path: "/inbox" } }),
							);
							break;
						case "m": // Go to My Tasks
							nextEvent.preventDefault();
							window.dispatchEvent(
								new CustomEvent("navigate-to", {
									detail: { path: "/tasks/my" },
								}),
							);
							break;
						case "t": // Go to All Tasks
							nextEvent.preventDefault();
							window.dispatchEvent(
								new CustomEvent("navigate-to", { detail: { path: "/tasks" } }),
							);
							break;
						case "c": // Go to Competitions
							nextEvent.preventDefault();
							window.dispatchEvent(
								new CustomEvent("navigate-to", {
									detail: { path: "/competitions" },
								}),
							);
							break;
					}
				};

				// Add temporary listener for next key
				window.addEventListener("keydown", handleNextKey, { once: true });

				// Remove listener after 1 second if no key pressed
				setTimeout(() => {
					window.removeEventListener("keydown", handleNextKey);
				}, 1000);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	return { commandMenuOpen, setCommandMenuOpen };
}
