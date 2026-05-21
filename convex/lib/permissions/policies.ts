import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { TEAM_NAMES } from "../constants";
import { requireAuthenticatedUserId } from "./authn";
import { throwForbidden } from "./require";
import { isMemberOfAnyTeam, isMemberOfTeam } from "./teams";

type PolicyCtx = QueryCtx | MutationCtx;

export const PERMISSION_KEYS = {
	DIRECTOR: "director",
	DELEGATE: "delegate",
	VOLUNTEER: "volunteer",
	WCA_2FA: "wca2fa",
	SPONSORSHIP_MANAGER: "sponsorshipManager",
	SOCIAL_MEDIA_DASHBOARD: "socialMediaDashboard",
} as const;

export type PermissionKey =
	(typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

const DEFAULT_FORBIDDEN_MESSAGES: Record<PermissionKey, string> = {
	[PERMISSION_KEYS.DIRECTOR]: "Directors only.",
	[PERMISSION_KEYS.DELEGATE]: "Delegates only.",
	[PERMISSION_KEYS.VOLUNTEER]: "Volunteer access required.",
	[PERMISSION_KEYS.WCA_2FA]: "Directors or Competitions Team members only.",
	[PERMISSION_KEYS.SPONSORSHIP_MANAGER]: "Directors or Finance Team only.",
	[PERMISSION_KEYS.SOCIAL_MEDIA_DASHBOARD]:
		"Directors or Social Media Team members only.",
};

async function hasPermissionForUser(
	ctx: PolicyCtx,
	userId: Id<"users">,
	key: PermissionKey,
): Promise<boolean> {
	switch (key) {
		case PERMISSION_KEYS.DIRECTOR:
			return isMemberOfTeam(ctx, userId, TEAM_NAMES.DIRECTORS);
		case PERMISSION_KEYS.DELEGATE:
			return isMemberOfTeam(ctx, userId, TEAM_NAMES.DELEGATES);
		case PERMISSION_KEYS.VOLUNTEER:
			return isMemberOfTeam(ctx, userId, TEAM_NAMES.VOLUNTEER);
		case PERMISSION_KEYS.WCA_2FA:
			return isMemberOfAnyTeam(ctx, userId, [
				TEAM_NAMES.DIRECTORS,
				TEAM_NAMES.COMPETITIONS,
			]);
		case PERMISSION_KEYS.SPONSORSHIP_MANAGER:
			return isMemberOfAnyTeam(ctx, userId, [
				TEAM_NAMES.DIRECTORS,
				TEAM_NAMES.FINANCE,
			]);
		case PERMISSION_KEYS.SOCIAL_MEDIA_DASHBOARD:
			return isMemberOfAnyTeam(ctx, userId, [
				TEAM_NAMES.DIRECTORS,
				TEAM_NAMES.SOCIAL_MEDIA,
			]);
	}
}

export async function hasPermission(
	ctx: PolicyCtx,
	key: PermissionKey,
	userId: Id<"users"> | null,
): Promise<boolean> {
	if (!userId) return false;
	return hasPermissionForUser(ctx, userId, key);
}

export async function requirePermission(
	ctx: PolicyCtx,
	key: PermissionKey,
	message?: string,
): Promise<Id<"users">> {
	const userId = await requireAuthenticatedUserId(ctx);
	const allowed = await hasPermissionForUser(ctx, userId, key);
	if (!allowed) {
		throwForbidden(message ?? DEFAULT_FORBIDDEN_MESSAGES[key]);
	}
	return userId;
}

export async function isDirectorForCtx(ctx: PolicyCtx): Promise<boolean> {
	const userId = await requireAuthenticatedUserIdOrNull(ctx);
	return hasPermission(ctx, PERMISSION_KEYS.DIRECTOR, userId);
}

export async function isDelegateForCtx(ctx: PolicyCtx): Promise<boolean> {
	const userId = await requireAuthenticatedUserIdOrNull(ctx);
	return hasPermission(ctx, PERMISSION_KEYS.DELEGATE, userId);
}

export async function isVolunteerForCtx(ctx: PolicyCtx): Promise<boolean> {
	const userId = await requireAuthenticatedUserIdOrNull(ctx);
	return hasPermission(ctx, PERMISSION_KEYS.VOLUNTEER, userId);
}

export async function canAccessWca2faForCtx(ctx: PolicyCtx): Promise<boolean> {
	const userId = await requireAuthenticatedUserIdOrNull(ctx);
	return hasPermission(ctx, PERMISSION_KEYS.WCA_2FA, userId);
}

export async function isSponsorshipManagerForCtx(
	ctx: PolicyCtx,
): Promise<boolean> {
	const userId = await requireAuthenticatedUserIdOrNull(ctx);
	return hasPermission(ctx, PERMISSION_KEYS.SPONSORSHIP_MANAGER, userId);
}

export async function canAccessSocialMediaDashboardForCtx(
	ctx: PolicyCtx,
): Promise<boolean> {
	const userId = await requireAuthenticatedUserIdOrNull(ctx);
	return hasPermission(ctx, PERMISSION_KEYS.SOCIAL_MEDIA_DASHBOARD, userId);
}

async function requireAuthenticatedUserIdOrNull(
	ctx: PolicyCtx,
): Promise<Id<"users"> | null> {
	try {
		return await requireAuthenticatedUserId(ctx);
	} catch {
		return null;
	}
}

export type PermissionSnapshot = {
	isDirector: boolean;
	isDelegate: boolean;
	isVolunteer: boolean;
	canAccessWca2fa: boolean;
	isSponsorshipManager: boolean;
	canAccessSocialMediaDashboard: boolean;
};

export async function getPermissionSnapshot(
	ctx: PolicyCtx,
): Promise<PermissionSnapshot> {
	const userId = await requireAuthenticatedUserIdOrNull(ctx);
	return {
		isDirector: await hasPermission(ctx, PERMISSION_KEYS.DIRECTOR, userId),
		isDelegate: await hasPermission(ctx, PERMISSION_KEYS.DELEGATE, userId),
		isVolunteer: await hasPermission(ctx, PERMISSION_KEYS.VOLUNTEER, userId),
		canAccessWca2fa: await hasPermission(ctx, PERMISSION_KEYS.WCA_2FA, userId),
		isSponsorshipManager: await hasPermission(
			ctx,
			PERMISSION_KEYS.SPONSORSHIP_MANAGER,
			userId,
		),
		canAccessSocialMediaDashboard: await hasPermission(
			ctx,
			PERMISSION_KEYS.SOCIAL_MEDIA_DASHBOARD,
			userId,
		),
	};
}
