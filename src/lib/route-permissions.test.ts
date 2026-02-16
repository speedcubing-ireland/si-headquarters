import { describe, expect, test } from "vitest";
import {
	PROTECTED_ROUTES,
	SIDEBAR_DASHBOARD_ITEMS,
	type RoutePermissionKey,
} from "./route-permissions";

describe("route-permissions alignment", () => {
	test("every sidebar dashboard item has a route permission and it matches", () => {
		for (const item of SIDEBAR_DASHBOARD_ITEMS) {
			const routePermission = PROTECTED_ROUTES[item.path];
			expect(
				routePermission,
				`Missing PROTECTED_ROUTES for ${item.path}`,
			).toBeDefined();
			expect(
				routePermission,
				`Sidebar permission for ${item.path} must match route guard`,
			).toBe(item.permission);
		}
	});

	test("every protected admin route that has a sidebar link is in SIDEBAR_DASHBOARD_ITEMS with same permission", () => {
		const sidebarPaths = new Set(SIDEBAR_DASHBOARD_ITEMS.map((i) => i.path));
		const sidebarByPath = new Map(
			SIDEBAR_DASHBOARD_ITEMS.map((i) => [i.path, i.permission]),
		);
		for (const path of Object.keys(PROTECTED_ROUTES)) {
			if (!path.startsWith("/admin/")) continue;
			const routePermission = PROTECTED_ROUTES[path] as RoutePermissionKey;
			if (sidebarPaths.has(path)) {
				expect(sidebarByPath.get(path)).toBe(routePermission);
			}
		}
	});

	test("PROTECTED_ROUTES uses only known permission keys", () => {
		const known: RoutePermissionKey[] = [
			"isDirector",
			"isVolunteer",
			"canAccessWca2fa",
			"isSponsorshipManager",
			"canAccessSocialMediaDashboard",
		];
		for (const path of Object.keys(PROTECTED_ROUTES)) {
			const perm = PROTECTED_ROUTES[path];
			expect(known, `Unknown permission "${perm}" for ${path}`).toContain(perm);
		}
	});
});
