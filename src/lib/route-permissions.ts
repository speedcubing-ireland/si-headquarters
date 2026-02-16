/**
 * Single source of truth for which routes require which permission (from
 * admin.getPermissionSnapshot). Used to keep route guards and sidebar
 * visibility aligned and to document mandatory permission usage.
 */

export type RoutePermissionKey =
	| "isDirector"
	| "isVolunteer"
	| "canAccessWca2fa"
	| "isSponsorshipManager"
	| "canAccessSocialMediaDashboard";

/** Routes that are protected by PermissionGuard and the snapshot key they require. */
export const PROTECTED_ROUTES: Record<string, RoutePermissionKey> = {
	"/admin/god-mode": "isDirector",
	"/admin/email": "isDirector",
	"/admin/wca-2fa": "canAccessWca2fa",
	"/admin/social-media": "canAccessSocialMediaDashboard",
	"/admin/sponsorship": "isSponsorshipManager",
	"/events": "isVolunteer",
};

/** Dashboard section sidebar items that link to protected admin routes. */
export const SIDEBAR_DASHBOARD_ITEMS: ReadonlyArray<{
	path: string;
	permission: RoutePermissionKey;
}> = [
	{ path: "/admin/sponsorship", permission: "isSponsorshipManager" },
	{ path: "/admin/god-mode", permission: "isDirector" },
	{ path: "/admin/wca-2fa", permission: "canAccessWca2fa" },
	{ path: "/admin/social-media", permission: "canAccessSocialMediaDashboard" },
];
