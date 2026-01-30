import { useRouterState } from "@tanstack/react-router";

/**
 * Returns true when the current path is a child of the given segment
 * (e.g. /competitions/123 for segment "competitions").
 * Used by list routes to decide whether to show the list or render Outlet for detail.
 */
export function useIsDetailRoute(segmentName: string): boolean {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const segments = pathname.split("/").filter(Boolean);
	return segments.length > 1 && segments[0] === segmentName;
}
