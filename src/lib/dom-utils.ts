const BASE_INTERACTIVE_SELECTOR =
	"button,[role=button],a[href],input,select,textarea,[contenteditable=true]";

const RADIX_DATA_SLOT_SELECTOR =
	'[data-slot="dropdown-menu-content"],[data-slot="dropdown-menu-item"],[data-slot="select-content"],[data-slot="select-item"],[data-slot="command"],[data-slot="command-item"]';

const RADIX_TRIGGER_SELECTOR =
	"[data-slot='dropdown-menu-trigger'],[data-slot='select-trigger'],[data-slot='command']";

const MENU_ROLE_SELECTOR =
	'[role="menuitem"],[role="option"],[role="combobox"],[role="listbox"]';

function matchesSelector(
	element: HTMLElement | null,
	selector: string,
	method: "closest" | "querySelector",
): boolean {
	if (!element) return false;
	return method === "closest"
		? !!element.closest(selector)
		: !!element.querySelector(selector);
}

export function isInteractiveTarget(target: HTMLElement | null): boolean {
	if (!target) return false;

	return (
		matchesSelector(target, BASE_INTERACTIVE_SELECTOR, "closest") ||
		matchesSelector(target, RADIX_DATA_SLOT_SELECTOR, "closest") ||
		matchesSelector(target, MENU_ROLE_SELECTOR, "closest") ||
		matchesSelector(target, "[data-radix-portal]", "closest")
	);
}

export function cellContainsInteractiveElements(
	cellElement: HTMLElement | null,
): boolean {
	if (!cellElement) return false;

	const interactiveSelector = `${BASE_INTERACTIVE_SELECTOR},${RADIX_TRIGGER_SELECTOR}`;
	return matchesSelector(cellElement, interactiveSelector, "querySelector");
}
