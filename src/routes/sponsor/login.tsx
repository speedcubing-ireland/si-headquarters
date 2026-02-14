import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { isSponsorshipEnabled } from "@/lib/feature-flags";
import { sponsorAuthClient } from "@/lib/sponsor-auth-client";

const OTP_REQUEST_UI_TIMEOUT_MS = 3_000;

export const Route = createFileRoute("/sponsor/login")({
	component: SponsorLoginRoute,
});

function SponsorLoginRoute() {
	if (!isSponsorshipEnabled) {
		return <Navigate to="/" />;
	}
	return <SponsorLoginEnabled />;
}

function SponsorLoginEnabled() {
	const navigate = useNavigate();
	const { data: session, isPending } = sponsorAuthClient.useSession();
	const [panel, setPanel] = useState<"sign-in" | "reset">("sign-in");
	const [signInEmail, setSignInEmail] = useState("");
	const [password, setPassword] = useState("");
	const [signInOtp, setSignInOtp] = useState("");
	const [resetEmail, setResetEmail] = useState("");
	const [resetOtp, setResetOtp] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [isBusy, setIsBusy] = useState(false);

	useEffect(() => {
		if (!session) return;
		void navigate({ to: "/sponsor/auctions" });
	}, [navigate, session]);

	const normalizeEmail = (value: string) => value.trim().toLowerCase();
	const getErrorMessage = (error: unknown, fallback: string) =>
		error instanceof Error ? error.message : fallback;
	const isLikelyTimeoutMessage = (message: string) => {
		const normalized = message.toLowerCase();
		return normalized.includes("timed out") || normalized.includes("timeout");
	};
	const ensureNoAuthError = (
		result: { error?: { message?: string | null } | null },
		fallback: string,
	) => {
		if (result.error) {
			throw new Error(result.error.message ?? fallback);
		}
	};
	const runAuthAction = async (
		task: () => Promise<void>,
		fallbackMessage: string,
	) => {
		setIsBusy(true);
		try {
			await task();
		} catch (error) {
			toast.error(getErrorMessage(error, fallbackMessage));
		} finally {
			setIsBusy(false);
		}
	};
	const runOtpSendAction = async (
		task: () => Promise<void>,
		successMessage: string,
		fallbackMessage: string,
	) => {
		const timedOut = Symbol("otp-send-timeout");
		setIsBusy(true);
		const request = task();
		try {
			const result = await Promise.race([
				request.then(() => "completed" as const),
				new Promise<typeof timedOut>((resolve) => {
					setTimeout(() => resolve(timedOut), OTP_REQUEST_UI_TIMEOUT_MS);
				}),
			]);
			if (result === timedOut) {
				toast.success(successMessage);
				void request.catch((error) => {
					const message = getErrorMessage(error, fallbackMessage);
					if (!isLikelyTimeoutMessage(message)) {
						toast.error(message);
					}
				});
				return;
			}
			toast.success(successMessage);
		} catch (error) {
			const message = getErrorMessage(error, fallbackMessage);
			if (isLikelyTimeoutMessage(message)) {
				toast.success(successMessage);
				return;
			}
			toast.error(message);
		} finally {
			setIsBusy(false);
		}
	};

	const onPasswordSignIn = async (event: FormEvent) => {
		event.preventDefault();
		await runAuthAction(async () => {
			const result = await sponsorAuthClient.signIn.email({
				email: normalizeEmail(signInEmail),
				password,
				rememberMe: true,
			});
			ensureNoAuthError(result, "Failed to sign in.");
			toast.success("Signed in.");
			await navigate({ to: "/sponsor/auctions" });
		}, "Failed to sign in.");
	};

	const onSendSignInOtp = async () => {
		await runOtpSendAction(
			async () => {
				const result = await sponsorAuthClient.emailOtp.sendVerificationOtp({
					email: normalizeEmail(signInEmail),
					type: "sign-in",
				});
				ensureNoAuthError(result, "Failed to send code.");
			},
			"Sign-in code sent.",
			"Failed to send code.",
		);
	};

	const onOtpSignIn = async (event: FormEvent) => {
		event.preventDefault();
		await runAuthAction(async () => {
			const result = await sponsorAuthClient.signIn.emailOtp({
				email: normalizeEmail(signInEmail),
				otp: signInOtp,
			});
			ensureNoAuthError(result, "Failed to sign in.");
			toast.success("Signed in.");
			await navigate({ to: "/sponsor/auctions" });
		}, "Failed to sign in.");
	};

	const onSendResetOtp = async () => {
		await runOtpSendAction(
			async () => {
				const result = await sponsorAuthClient.forgetPassword.emailOtp({
					email: normalizeEmail(resetEmail),
				});
				ensureNoAuthError(result, "Failed to send reset code.");
			},
			"Password reset code sent.",
			"Failed to send reset code.",
		);
	};

	const onResetPassword = async (event: FormEvent) => {
		event.preventDefault();
		await runAuthAction(async () => {
			const result = await sponsorAuthClient.emailOtp.resetPassword({
				email: normalizeEmail(resetEmail),
				otp: resetOtp,
				password: newPassword,
			});
			ensureNoAuthError(result, "Failed to reset password.");
			toast.success("Password updated. Sign in with your new password.");
			setResetOtp("");
			setNewPassword("");
			setPanel("sign-in");
			setSignInEmail(normalizeEmail(resetEmail));
		}, "Failed to reset password.");
	};

	const onPasskeySignIn = async () => {
		await runAuthAction(async () => {
			const result = await sponsorAuthClient.signIn.passkey();
			if (result.error) {
				const code = "code" in result.error ? result.error.code : undefined;
				if (code === "AUTH_CANCELLED") {
					throw new Error(
						"Passkey sign-in was cancelled or no matching passkey was selected.",
					);
				}
			}
			ensureNoAuthError(result, "Passkey sign-in failed.");
			toast.success("Signed in with passkey.");
			await navigate({ to: "/sponsor/auctions" });
		}, "Passkey sign-in failed.");
	};

	const onOpenResetPanel = () => {
		setResetEmail((current) => current || normalizeEmail(signInEmail));
		setPanel("reset");
	};

	return (
		<div className="min-h-svh bg-gradient-to-b from-muted/40 to-background px-4 py-10">
			<div className="mx-auto w-full max-w-md space-y-4">
				{isPending ? (
					<Card className="border-muted-foreground/10 shadow-sm">
						<CardContent className="flex items-center justify-center py-10">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</CardContent>
					</Card>
				) : panel === "sign-in" ? (
					<>
						<Card className="border-muted-foreground/10 shadow-sm">
							<CardHeader className="space-y-3">
								<Badge className="w-fit" variant="secondary">
									Sponsor Portal
								</Badge>
								<CardTitle className="text-2xl">Sponsor sign-in</CardTitle>
								<CardDescription>
									Enter your sponsor email first. Then choose how to sign in.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<Label htmlFor="signInEmail">Email</Label>
									<Input
										id="signInEmail"
										type="email"
										autoComplete="email"
										value={signInEmail}
										onChange={(event) => setSignInEmail(event.target.value)}
										required
										disabled={isBusy}
									/>
								</div>
							</CardContent>
						</Card>
						<Card className="border-muted-foreground/10 shadow-sm">
							<CardContent className="space-y-6 pt-6">
								<form className="space-y-4" onSubmit={onPasswordSignIn}>
									<div className="space-y-2">
										<Label htmlFor="password">Password</Label>
										<Input
											id="password"
											type="password"
											autoComplete="current-password"
											value={password}
											onChange={(event) => setPassword(event.target.value)}
											required
											disabled={isBusy}
										/>
									</div>
									<Button
										className="w-full"
										type="submit"
										disabled={isBusy || !signInEmail.trim()}
									>
										{isBusy ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											"Sign in"
										)}
									</Button>
								</form>
								<div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
									<Separator className="flex-1" />
									<span>or</span>
									<Separator className="flex-1" />
								</div>
								<Button
									className="w-full"
									type="button"
									variant="outline"
									disabled={isBusy}
									onClick={() => void onPasskeySignIn()}
								>
									{isBusy ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										"Sign in with passkey"
									)}
								</Button>
								<div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
									<Separator className="flex-1" />
									<span>or</span>
									<Separator className="flex-1" />
								</div>
								<form className="space-y-3" onSubmit={onOtpSignIn}>
									<Label htmlFor="signInOtp">One-time email code</Label>
									<div className="flex gap-2">
										<Input
											id="signInOtp"
											value={signInOtp}
											onChange={(event) => setSignInOtp(event.target.value)}
											placeholder="One-time code"
											className="min-w-[11rem] font-mono tracking-[0.2em]"
											required
											disabled={isBusy}
										/>
										<Button
											type="button"
											variant="outline"
											disabled={isBusy || !signInEmail.trim()}
											onClick={() => void onSendSignInOtp()}
										>
											Send code
										</Button>
									</div>
									<Button
										className="w-full"
										type="submit"
										disabled={isBusy || !signInEmail.trim()}
									>
										Sign in with OTP
									</Button>
								</form>
								<Button
									type="button"
									variant="link"
									className="h-auto px-0 text-sm"
									disabled={isBusy}
									onClick={onOpenResetPanel}
								>
									Reset password with OTP
								</Button>
							</CardContent>
						</Card>
					</>
				) : (
					<Card className="border-muted-foreground/10 shadow-sm">
						<CardHeader className="space-y-3">
							<Badge className="w-fit" variant="secondary">
								Sponsor Portal
							</Badge>
							<CardTitle className="text-2xl">Reset password</CardTitle>
							<CardDescription>
								Use a one-time email code to set a new password.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form className="space-y-4" onSubmit={onResetPassword}>
								<div className="space-y-2">
									<Label htmlFor="resetEmail">Email</Label>
									<Input
										id="resetEmail"
										type="email"
										autoComplete="email"
										value={resetEmail}
										onChange={(event) => setResetEmail(event.target.value)}
										required
										disabled={isBusy}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="resetOtp">Reset code</Label>
									<div className="flex gap-2">
										<Input
											id="resetOtp"
											value={resetOtp}
											onChange={(event) => setResetOtp(event.target.value)}
											placeholder="One-time code"
											className="min-w-[11rem] font-mono tracking-[0.2em]"
											required
											disabled={isBusy}
										/>
										<Button
											type="button"
											variant="outline"
											disabled={isBusy || !resetEmail.trim()}
											onClick={() => void onSendResetOtp()}
										>
											Send code
										</Button>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="newPassword">New password</Label>
									<Input
										id="newPassword"
										type="password"
										autoComplete="new-password"
										placeholder="Minimum 12 characters"
										value={newPassword}
										onChange={(event) => setNewPassword(event.target.value)}
										minLength={12}
										required
										disabled={isBusy}
									/>
								</div>
								<Button className="w-full" type="submit" disabled={isBusy}>
									{isBusy ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										"Update password"
									)}
								</Button>
								<Button
									type="button"
									variant="link"
									className="h-auto px-0 text-sm"
									disabled={isBusy}
									onClick={() => setPanel("sign-in")}
								>
									Back to sign in
								</Button>
							</form>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
