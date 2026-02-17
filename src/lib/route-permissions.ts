import {
	HandCoins,
	KeyRound,
	type LucideIcon,
	Megaphone,
	Shield,
	Store,
} from "lucide-react";
import type { FileRoutesByTo } from "@/routeTree.gen";

export type RoutePermissionKey =
	| "isDirector"
	| "isVolunteer"
	| "canAccessWca2fa"
	| "isSponsorshipManager"
	| "canAccessSocialMediaDashboard";

export const PROTECTED_ROUTES: Record<string, RoutePermissionKey> = {
	"/admin/god-mode": "isDirector",
	"/admin/email": "isDirector",
	"/admin/refunds": "isVolunteer",
	"/admin/wca-2fa": "canAccessWca2fa",
	"/admin/social-media": "canAccessSocialMediaDashboard",
	"/admin/sponsorship": "isSponsorshipManager",
	"/events": "isVolunteer",
};

export const SIDEBAR_DASHBOARD_ITEMS: ReadonlyArray<{
	path: keyof FileRoutesByTo;
	permission: RoutePermissionKey;
	orPermissions?: readonly RoutePermissionKey[];
	name: string;
	icon: LucideIcon;
}> = [
	{
		path: "/admin/sponsorship",
		permission: "isSponsorshipManager",
		name: "Sponsorship",
		icon: Store,
	},
	{
		path: "/admin/god-mode",
		permission: "isDirector",
		name: "God Mode",
		icon: Shield,
	},
	{
		path: "/admin/refunds",
		permission: "isVolunteer",
		orPermissions: ["isDirector"],
		name: "Refunds",
		icon: HandCoins,
	},
	{
		path: "/admin/wca-2fa",
		permission: "canAccessWca2fa",
		name: "WCA 2FA",
		icon: KeyRound,
	},
	{
		path: "/admin/social-media",
		permission: "canAccessSocialMediaDashboard",
		name: "Social Media",
		icon: Megaphone,
	},
];
