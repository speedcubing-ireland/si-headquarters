function trimTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * HQ app origin (volunteer dashboard, admin). Use for internal / staff links only.
 */
export function resolveHqSiteBaseUrl(): string {
	return trimTrailingSlash(
		process.env.SITE_URL ?? "https://hq.speedcubing.ie",
	);
}

/**
 * Sponsor portal SPA base URL. Prefer `SPONSOR_SITE_URL` when sponsors live on
 * a different host than HQ (e.g. sponsors.example.com).
 */
export function resolveSponsorPortalBaseUrl(): string {
	return trimTrailingSlash(
		process.env.SPONSOR_SITE_URL ??
			process.env.SITE_URL ??
			"https://hq.speedcubing.ie",
	);
}

/**
 * Sponsor origin for Better Auth (includes local-dev defaults when env is unset).
 */
export function resolveSponsorPortalBaseUrlForAuth(): string {
	return trimTrailingSlash(
		process.env.SPONSOR_SITE_URL ??
			process.env.SITE_URL ??
			process.env.NEXT_PUBLIC_SITE_URL ??
			(process.env.NODE_ENV === "production"
				? "https://sponsors.speedcubingireland.com"
				: "http://localhost:5174"),
	);
}

export function resolveSponsorPortalOriginForAuth(): string {
	return new URL(resolveSponsorPortalBaseUrlForAuth()).origin;
}

export function sponsorPortalLoginUrl(): string {
	return `${resolveSponsorPortalBaseUrl()}/sponsor/login`;
}

export function sponsorPortalAuctionUrl(auctionId: string): string {
	return `${resolveSponsorPortalBaseUrl()}/sponsor/auctions/${auctionId}`;
}

export function sponsorPortalAuctionsIndexUrl(): string {
	return `${resolveSponsorPortalBaseUrl()}/sponsor/auctions`;
}

export function sponsorshipAdminPageUrl(): string {
	return `${resolveHqSiteBaseUrl()}/admin/sponsorship`;
}
