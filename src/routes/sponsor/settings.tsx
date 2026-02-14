import {
	createFileRoute,
	Link,
	Navigate,
	useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	ArrowLeft,
	Loader2,
	LogOut,
	Monitor,
	Moon,
	Sun,
	type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
	SponsorPageHeader,
	SponsorPageShell,
} from "@/components/sponsorship/sponsor-page-layout";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSponsorshipEnabled } from "@/lib/feature-flags";
import { sponsorAuthClient } from "@/lib/sponsor-auth-client";

type Theme = "light" | "dark" | "system";

const THEMES: Array<{
	value: Theme;
	label: string;
	icon: LucideIcon;
}> = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
];

export const Route = createFileRoute("/sponsor/settings")({
	component: SponsorSettingsRoute,
});

function ThemeToggleButton() {
	const { theme, setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" className="relative">
					<Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
					<Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
					<span className="sr-only">Toggle theme</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{THEMES.map(({ value, label, icon: Icon }) => (
					<DropdownMenuItem key={value} onClick={() => setTheme(value)}>
						<Icon className="mr-2 size-4" />
						<span>{label}</span>
						{theme === value ? (
							<span className="ml-auto text-xs">✓</span>
						) : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function toActionError(error: unknown, fallback: string): string {
	if (!(error instanceof Error)) {
		return fallback;
	}
	const allowedMessages = new Set([
		"Sponsor session expired. Please sign in again.",
		"Display name cannot be empty.",
	]);
	if (allowedMessages.has(error.message)) {
		return error.message;
	}
	return error.message || fallback;
}

function SponsorSettingsRoute() {
	if (!isSponsorshipEnabled) {
		return <Navigate to="/" />;
	}
	return <SponsorSettingsEnabled />;
}

function SponsorSettingsEnabled() {
	const navigate = useNavigate();
	const { data: authSession, isPending: authPending } =
		sponsorAuthClient.useSession();
	const sessionToken = authSession?.session.token ?? null;
	const me = useQuery(
		api.sponsorPortal.me,
		sessionToken ? { sessionToken } : "skip",
	);
	const updateDisplayName = useMutation(api.sponsorPortal.updateDisplayName);
	const [displayName, setDisplayName] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [isSavingName, setIsSavingName] = useState(false);
	const [isAddingPasskey, setIsAddingPasskey] = useState(false);
	const [isChangingPassword, setIsChangingPassword] = useState(false);

	useEffect(() => {
		if (authPending) return;
		if (sessionToken) return;
		void navigate({ to: "/sponsor/login" });
	}, [authPending, navigate, sessionToken]);

	useEffect(() => {
		if (!me?.name) return;
		setDisplayName(me.name);
	}, [me?.name]);

	if (authPending || !sessionToken) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const onSaveDisplayName = async (event: FormEvent) => {
		event.preventDefault();
		setIsSavingName(true);
		try {
			await updateDisplayName({
				sessionToken,
				displayName,
			});
			toast.success("Display name updated.");
		} catch (error) {
			toast.error(toActionError(error, "Failed to update display name."));
		} finally {
			setIsSavingName(false);
		}
	};

	const onAddPasskey = async () => {
		setIsAddingPasskey(true);
		try {
			const result = await sponsorAuthClient.passkey.addPasskey();
			if (result.error) {
				throw new Error(result.error.message ?? "Failed to add passkey.");
			}
			toast.success("Passkey added.");
		} catch (error) {
			toast.error(toActionError(error, "Failed to add passkey."));
		} finally {
			setIsAddingPasskey(false);
		}
	};

	const onChangePassword = async (event: FormEvent) => {
		event.preventDefault();
		setIsChangingPassword(true);
		try {
			const result = await sponsorAuthClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true,
			});
			if (result.error) {
				throw new Error(result.error.message ?? "Failed to change password.");
			}
			toast.success("Password updated.");
			setCurrentPassword("");
			setNewPassword("");
		} catch (error) {
			toast.error(toActionError(error, "Failed to change password."));
		} finally {
			setIsChangingPassword(false);
		}
	};

	const onLogout = async () => {
		await sponsorAuthClient.signOut();
		toast.success("Signed out.");
		await navigate({ to: "/sponsor/login" });
	};

	return (
		<SponsorPageShell maxWidthClassName="max-w-3xl">
			<SponsorPageHeader
				title="Settings"
				actions={
					<>
						<ThemeToggleButton />
						<Button variant="outline" onClick={() => void onLogout()}>
							<LogOut className="size-4" />
							Log out
						</Button>
					</>
				}
			/>

			<Button asChild variant="outline" size="sm">
				<Link to="/sponsor/auctions">
					<ArrowLeft className="size-4" />
					Back to auctions
				</Link>
			</Button>

			<div className="grid gap-4">
				<Card>
					<CardHeader>
						<CardTitle>Profile</CardTitle>
						<CardDescription>Update your sponsor display name.</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-3" onSubmit={onSaveDisplayName}>
							<div className="space-y-2">
								<Label htmlFor="displayName">Display name</Label>
								<Input
									id="displayName"
									value={displayName}
									onChange={(event) => setDisplayName(event.target.value)}
									required
									disabled={isSavingName}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input id="email" value={me?.email ?? ""} readOnly disabled />
							</div>
							<Button type="submit" size="sm" disabled={isSavingName}>
								{isSavingName ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									"Save name"
								)}
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Security</CardTitle>
						<CardDescription>
							Add a passkey and change your password.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="rounded-md border p-3">
							<p className="font-medium">Passkey</p>
							<p className="mb-2 text-sm text-muted-foreground">
								Use a passkey for fast phishing-resistant sign-in.
							</p>
							<Button
								size="sm"
								variant="outline"
								disabled={isAddingPasskey}
								onClick={() => void onAddPasskey()}
							>
								{isAddingPasskey ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									"Add passkey"
								)}
							</Button>
						</div>

						<form className="space-y-3" onSubmit={onChangePassword}>
							<div className="space-y-2">
								<Label htmlFor="currentPassword">Current password</Label>
								<Input
									id="currentPassword"
									type="password"
									autoComplete="current-password"
									value={currentPassword}
									onChange={(event) => setCurrentPassword(event.target.value)}
									required
									disabled={isChangingPassword}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="newPassword">New password</Label>
								<Input
									id="newPassword"
									type="password"
									autoComplete="new-password"
									minLength={12}
									value={newPassword}
									onChange={(event) => setNewPassword(event.target.value)}
									required
									disabled={isChangingPassword}
								/>
							</div>
							<p className="text-xs text-muted-foreground">
								For forgotten passwords, use reset on the{" "}
								<Link to="/sponsor/login" className="underline">
									sign-in page
								</Link>
								.
							</p>
							<Button type="submit" size="sm" disabled={isChangingPassword}>
								{isChangingPassword ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									"Change password"
								)}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</SponsorPageShell>
	);
}
