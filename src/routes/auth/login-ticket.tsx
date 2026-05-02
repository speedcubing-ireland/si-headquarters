import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminImpersonationMutations } from "@/hooks/use-convex-data";
import { sponsorAuthClient } from "@/lib/sponsor-auth-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	clearConsumptionNonce,
	getOrCreateConsumptionNonce,
	parseKind,
} from "@/lib/login-ticket-utils";

type StatusState =
	| { type: "working"; message: string }
	| { type: "error"; message: string };

export const Route = createFileRoute("/auth/login-ticket")({
	component: LoginTicketRoute,
});

function LoginTicketRoute() {
	const navigate = useNavigate();
	const { signIn } = useAuthActions();
	const { isAuthenticated, isLoading } = useConvexAuth();
	const { consumeSponsorImpersonationTicket } =
		useAdminImpersonationMutations();
	const [status, setStatus] = useState<StatusState>({
		type: "working",
		message: "Validating login link...",
	});

	const search = useMemo(
		() =>
			typeof window === "undefined"
				? null
				: new URLSearchParams(window.location.search),
		[],
	);
	const ticket = search?.get("ticket")?.trim() ?? "";
	const kind = parseKind(search?.get("kind") ?? null);

	const consumptionNonce = useMemo(
		() => getOrCreateConsumptionNonce(ticket),
		[ticket],
	);
	const attemptedRequestKeyRef = useRef<string | null>(null);

	useEffect(() => {
		const requestKey = kind ? `${kind}:${ticket}:${consumptionNonce}` : null;
		let cancelled = false;

		if (requestKey && attemptedRequestKeyRef.current === requestKey) {
			return;
		}
		if (requestKey) {
			attemptedRequestKeyRef.current = requestKey;
		}

		const run = async () => {
			if (!ticket || !kind) {
				if (!cancelled) {
					setStatus({
						type: "error",
						message: "Invalid login link.",
					});
				}
				return;
			}

			try {
				if (kind === "user") {
					setStatus({
						type: "working",
						message: "Signing in as selected user...",
					});
					const result = await signIn("god-mode-ticket", {
						ticket,
						consumptionNonce,
					});
					if (cancelled) return;
					if (!result.signingIn) {
						throw new Error("Login link is invalid or expired.");
					}
					setStatus({
						type: "working",
						message: "Session established. Redirecting...",
					});
					clearConsumptionNonce(ticket);
					await navigate({ to: "/" });
					return;
				}

				setStatus({
					type: "working",
					message: "Signing in as selected sponsor...",
				});
				const { oneTimeToken } = await consumeSponsorImpersonationTicket({
					ticket,
					consumptionNonce,
				});
				if (cancelled) return;
				const crossDomain = (
					sponsorAuthClient as typeof sponsorAuthClient & {
						crossDomain: {
							oneTimeToken: {
								verify: (args: { token: string }) => Promise<{
									data?: { session?: { token?: string } | null } | null;
									error?: { message?: string | null } | null;
								}>;
							};
							updateSession?: () => void;
						};
					}
				).crossDomain;
				const verified = await crossDomain.oneTimeToken.verify({
					token: oneTimeToken,
				});
				if (cancelled) return;
				if (!verified.data?.session?.token) {
					throw new Error(
						verified.error?.message ?? "Failed to establish sponsor session.",
					);
				}
				// Populate the session cache before navigating so the sponsor portal
				// reads it immediately. The crossDomainClient sends the cookie that
				// was stored by the verify call above; calling getSession here with
				// an Authorization header would cause the plugin's onSuccess to clear
				// that cookie when the header causes the server to return null.
				await sponsorAuthClient.getSession();
				if (cancelled) return;
				crossDomain.updateSession?.();
				clearConsumptionNonce(ticket);
				await navigate({ to: "/sponsor/auctions" });
			} catch (error) {
				if (!cancelled) {
					setStatus({
						type: "error",
						message:
							error instanceof Error
								? error.message
								: "Could not complete login from this link.",
					});
				}
			}
		};

		void run();

		return () => {
			cancelled = true;
			// Allow StrictMode's remount to retry the same key.
			if (requestKey && attemptedRequestKeyRef.current === requestKey) {
				attemptedRequestKeyRef.current = null;
			}
		};
	}, [
		consumeSponsorImpersonationTicket,
		consumptionNonce,
		kind,
		navigate,
		signIn,
		ticket,
	]);

	useEffect(() => {
		if (kind !== "user") return;
		if (!isAuthenticated || isLoading) return;
		clearConsumptionNonce(ticket);
		void navigate({ to: "/" });
	}, [isAuthenticated, isLoading, kind, navigate, ticket]);

	return (
		<div className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-8">
			<Card className="w-full max-w-lg">
				<CardHeader>
					<CardTitle>Incognito Login</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{status.type === "working" ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" />
							<span>{status.message}</span>
						</div>
					) : (
						<p className="text-sm text-destructive">{status.message}</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
