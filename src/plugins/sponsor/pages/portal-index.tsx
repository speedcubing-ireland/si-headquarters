import { Navigate } from "@tanstack/react-router";
import { isSponsorshipEnabled } from "@/lib/feature-flags";
import { sponsorAuthClient } from "@/plugins/sponsor/lib/sponsor-auth-client";

export function PortalIndexPage() {
	if (!isSponsorshipEnabled) {
		return <Navigate to="/" />;
	}
	return <SponsorIndexEnabled />;
}

function SponsorIndexEnabled() {
	const { data: session, isPending } = sponsorAuthClient.useSession();
	if (isPending) {
		return null;
	}
	const sessionToken = session?.session.token ?? null;
	if (sessionToken !== null) {
		return <Navigate to="/sponsor/auctions" />;
	}
	return <Navigate to="/sponsor/login" />;
}
