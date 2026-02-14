import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import {
	AlertTriangle,
	Copy,
	Loader2,
	LockKeyhole,
	RefreshCw,
	ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppPageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useCanAccessWca2fa } from "@/hooks/use-convex-data";

const RING_RADIUS = 74;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type Wca2faCodeState = {
	code: string;
	digits: number;
	periodSeconds: number;
	generatedAtMs: number;
	expiresAtMs: number;
	serverNowMs: number;
};

function formatOtpCode(code: string, digits: number): string {
	if (digits === 6 && code.length >= 6) {
		return `${code.slice(0, 3)} ${code.slice(3, 6)}`;
	}
	if (digits === 8 && code.length >= 8) {
		return `${code.slice(0, 4)} ${code.slice(4, 8)}`;
	}
	return code;
}

function getErrorMessage(error: unknown): string {
	if (!(error instanceof Error)) {
		return "Could not generate the current WCA 2FA code.";
	}
	return error.message || "Could not generate the current WCA 2FA code.";
}

export const Route = createFileRoute("/admin/wca-2fa")({
	component: Wca2faRoute,
});

function Wca2faRoute() {
	const { canAccess, isLoading } = useCanAccessWca2fa();

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!canAccess) {
		return <Navigate to="/" />;
	}

	return <Wca2faPage />;
}

function Wca2faPage() {
	const generateCode = useAction(api.wca2fa.generateCode);
	const [codeState, setCodeState] = useState<Wca2faCodeState | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isFetching, setIsFetching] = useState(false);
	const [hasLoaded, setHasLoaded] = useState(false);
	const [serverOffsetMs, setServerOffsetMs] = useState(0);
	const [nowMs, setNowMs] = useState(() => Date.now());

	const refreshCode = useCallback(async () => {
		setIsFetching(true);
		try {
			const next = await generateCode({});
			setCodeState(next);
			setServerOffsetMs(next.serverNowMs - Date.now());
			setError(null);
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setIsFetching(false);
			setHasLoaded(true);
		}
	}, [generateCode]);

	useEffect(() => {
		void refreshCode();
	}, [refreshCode]);

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setNowMs(Date.now());
		}, 1000);
		return () => window.clearInterval(intervalId);
	}, []);

	const syncedNowMs = nowMs + serverOffsetMs;
	const remainingMs = useMemo(() => {
		if (!codeState) return 0;
		return Math.max(codeState.expiresAtMs - syncedNowMs, 0);
	}, [codeState, syncedNowMs]);
	const hasCode = codeState !== null;
	const isCodeActive = hasCode && remainingMs > 0;
	const periodMs = (codeState?.periodSeconds ?? 30) * 1000;
	const progress = isCodeActive
		? Math.min(Math.max(remainingMs / periodMs, 0), 1)
		: 0;
	const secondsRemaining = isCodeActive ? Math.ceil(remainingMs / 1000) : 0;
	const ringStrokeOffset = RING_CIRCUMFERENCE * (1 - progress);
	const formattedCode =
		isCodeActive && codeState
			? formatOtpCode(codeState.code, codeState.digits)
			: null;

	const copyCode = async () => {
		if (!codeState || !isCodeActive) return;
		try {
			await navigator.clipboard.writeText(codeState.code);
			toast.success("Code copied.");
		} catch {
			toast.error("Could not copy code.");
		}
	};

	const expiryVariant = !hasCode
		? "outline"
		: isCodeActive
			? secondsRemaining <= 5
				? "destructive"
				: "secondary"
			: "destructive";

	return (
		<div className="flex flex-1 flex-col">
			<AppPageHeader
				title="WCA 2FA"
				subtitle="Dashboard settings for Directors and Competitions Team"
			/>
			<div className="flex-1 p-4 lg:p-6">
				<div className="mx-auto w-full max-w-3xl">
					<Card className="border-border/70 shadow-sm">
						<CardHeader className="space-y-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<ShieldCheck className="size-4 text-primary" />
									<CardTitle>Verification code</CardTitle>
								</div>
								<div className="flex items-center gap-2">
									{!hasCode ? (
										<Badge variant={expiryVariant}>Ready</Badge>
									) : isCodeActive ? (
										<Badge variant={expiryVariant}>
											Expires in {secondsRemaining}s
										</Badge>
									) : (
										<Badge variant={expiryVariant}>Expired</Badge>
									)}
								</div>
							</div>
							<CardDescription>
								Generate a code when needed. Expired codes are hidden and must
								be regenerated manually.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
								<div className="relative mx-auto shrink-0 rounded-2xl border bg-muted/20 p-3">
									<svg
										viewBox="0 0 180 180"
										className="size-40 -rotate-90 text-primary md:size-44"
										role="img"
										aria-labelledby="wca-2fa-expiry-indicator-title"
									>
										<title id="wca-2fa-expiry-indicator-title">
											Code expiry indicator
										</title>
										<circle
											cx="90"
											cy="90"
											r={RING_RADIUS}
											fill="none"
											stroke="currentColor"
											strokeOpacity="0.14"
											strokeWidth="12"
										/>
										<circle
											cx="90"
											cy="90"
											r={RING_RADIUS}
											fill="none"
											stroke="currentColor"
											strokeWidth="12"
											strokeLinecap="round"
											strokeDasharray={RING_CIRCUMFERENCE}
											strokeDashoffset={ringStrokeOffset}
											className="transition-[stroke-dashoffset] duration-700 ease-linear"
										/>
									</svg>
									<div className="absolute inset-0 flex flex-col items-center justify-center">
										{isCodeActive ? (
											<>
												<span className="text-4xl font-semibold tabular-nums">
													{secondsRemaining}
												</span>
												<span className="text-xs text-muted-foreground">
													seconds left
												</span>
											</>
										) : (
											<>
												<LockKeyhole className="size-6 text-muted-foreground" />
												<span className="mt-1 text-xs text-muted-foreground">
													No active code
												</span>
											</>
										)}
									</div>
								</div>
								<div className="min-w-0 flex-1 space-y-4">
									<div className="rounded-xl border bg-card p-4 sm:p-5">
										{formattedCode ? (
											<>
												<p className="mb-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
													Current code
												</p>
												<p
													className="font-mono text-4xl font-semibold tracking-[0.2em] tabular-nums sm:text-5xl"
													aria-live="polite"
												>
													{formattedCode}
												</p>
											</>
										) : (
											<div className="py-2">
												<p className="text-sm font-medium">Code unavailable</p>
												<p className="mt-1 text-sm text-muted-foreground">
													Generate a new code to continue.
												</p>
											</div>
										)}
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<Button
											variant="default"
											onClick={() => void refreshCode()}
											disabled={isFetching}
										>
											{isFetching ? (
												<Loader2 className="size-4 animate-spin" />
											) : (
												<RefreshCw className="size-4" />
											)}
											{hasCode ? "Generate new code" : "Generate code"}
										</Button>
										<Button
											variant="outline"
											onClick={() => void copyCode()}
											disabled={!isCodeActive}
										>
											<Copy className="size-4" />
											Copy
										</Button>
									</div>
								</div>
							</div>
							{error ? (
								<Alert variant="destructive">
									<AlertTriangle className="size-4" />
									<AlertTitle>Code unavailable</AlertTitle>
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							) : null}
							{!error && !hasLoaded ? (
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Loader2 className="size-4 animate-spin" />
									Generating secure code...
								</div>
							) : null}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
