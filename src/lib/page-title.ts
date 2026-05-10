export function getPageTitle(pathname: string): string {
	const normalized = pathname.replace(/\/+$/, "") || "/";
	if (normalized === "/sponsor" || normalized.startsWith("/sponsor/")) {
		return "Sponsors | Speedcubing Ireland";
	}
	return "Headquarters | Speedcubing Ireland";
}
