import { useEffect, useState } from "react";

export function useGlobalShortcuts() {
	const [commandMenuOpen, setCommandMenuOpen] = useState(false);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setCommandMenuOpen((prev) => !prev);
				return;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	return { commandMenuOpen, setCommandMenuOpen };
}
