import { useRouterState } from "@tanstack/react-router";

export function useIsDetailRoute(segmentName: string): boolean {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const segments = pathname.split("/").filter(Boolean);
	return segments.length > 1 && segments[0] === segmentName;
}
