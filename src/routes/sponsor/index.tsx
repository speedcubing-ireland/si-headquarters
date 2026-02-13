import { createFileRoute, Navigate } from "@tanstack/react-router";
import { isSponsorshipEnabled } from "@/lib/feature-flags";
import { sponsorAuthClient } from "@/lib/sponsor-auth-client";

export const Route = createFileRoute("/sponsor/")({
	component: SponsorIndexRoute,
});

function SponsorIndexRoute() {
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
	if (sessionToken) {
		return <Navigate to="/sponsor/auctions" />;
	}
	return <Navigate to="/sponsor/login" />;
}
