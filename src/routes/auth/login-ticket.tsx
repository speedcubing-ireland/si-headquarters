import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminImpersonationMutations } from "@/hooks/use-convex-data";
import { sponsorAuthClient } from "@/lib/sponsor-auth-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LoginTicketKind = "user" | "sponsor";

type StatusState =
	| { type: "working"; message: string }
	| { type: "error"; message: string };

const CONSUMPTION_NONCE_STORAGE_KEY = "god-mode-impersonation-consumption";

function parseKind(value: string | null): LoginTicketKind | null {
	if (value === "user" || value === "sponsor") {
		return value;
	}
	return null;
}

function createConsumptionNonce(): string {
	if (typeof crypto !== "undefined") {
		if (typeof crypto.randomUUID === "function") {
			return crypto.randomUUID();
		}
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
			"",
		);
	}
	return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOrCreateConsumptionNonce(ticket: string): string {
	if (!ticket || typeof window === "undefined") {
		return createConsumptionNonce();
	}

	try {
		const raw = window.sessionStorage.getItem(CONSUMPTION_NONCE_STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as { ticket?: string; nonce?: string };
			if (
				parsed.ticket === ticket &&
				typeof parsed.nonce === "string" &&
				parsed.nonce.trim().length >= 16
			) {
				return parsed.nonce.trim();
			}
		}
	} catch {
		// Ignore malformed storage values and regenerate.
	}

	const nonce = createConsumptionNonce();
	try {
		window.sessionStorage.setItem(
			CONSUMPTION_NONCE_STORAGE_KEY,
			JSON.stringify({ ticket, nonce }),
		);
	} catch {
		// Ignore storage failures (e.g. blocked storage); nonce still works in-memory.
	}
	return nonce;
}

function clearConsumptionNonce(ticket: string): void {
	if (!ticket || typeof window === "undefined") return;
	try {
		const raw = window.sessionStorage.getItem(CONSUMPTION_NONCE_STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as { ticket?: string };
		if (parsed.ticket === ticket) {
			window.sessionStorage.removeItem(CONSUMPTION_NONCE_STORAGE_KEY);
		}
	} catch {
		// Ignore cleanup failures.
	}
}

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
	const isMountedRef = useRef(true);

	useEffect(() => {
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		const requestKey = kind ? `${kind}:${ticket}:${consumptionNonce}` : null;

		if (requestKey && attemptedRequestKeyRef.current === requestKey) {
			return;
		}
		if (requestKey) {
			attemptedRequestKeyRef.current = requestKey;
		}

		const run = async () => {
			if (!ticket || !kind) {
				if (isMountedRef.current) {
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
					if (!isMountedRef.current) return;
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
				if (!isMountedRef.current) return;
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
				if (!isMountedRef.current) return;
				const sessionToken = verified.data?.session?.token;
				if (!sessionToken) {
					throw new Error(
						verified.error?.message ?? "Failed to establish sponsor session.",
					);
				}
				await sponsorAuthClient.getSession({
					fetchOptions: {
						headers: {
							Authorization: `Bearer ${sessionToken}`,
						},
					},
				});
				if (!isMountedRef.current) return;
				crossDomain.updateSession?.();
				clearConsumptionNonce(ticket);
				await navigate({ to: "/sponsor/auctions" });
			} catch (error) {
				if (isMountedRef.current) {
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
