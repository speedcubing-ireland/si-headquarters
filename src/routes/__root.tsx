import {
	createRootRoute,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { Layout } from "@/components/layout/layout";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { isSponsorshipEnabled } from "@/lib/feature-flags";

const RootLayout = () => <RootLayoutInner />;

function RootLayoutInner() {
	const isSponsorPath = useRouterState({
		select: (state) =>
			isSponsorshipEnabled && state.location.pathname.startsWith("/sponsor"),
	});

	if (isSponsorPath) {
		return (
			<ErrorBoundary>
				<Outlet />
			</ErrorBoundary>
		);
	}

	return (
		<>
			<AuthLoading>
				<div className="flex min-h-svh items-center justify-center">
					<div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
				</div>
			</AuthLoading>
			<Authenticated>
				<EnsureVolunteerAccess />
				<ErrorBoundary>
					<Layout>
						<Outlet />
					</Layout>
				</ErrorBoundary>
			</Authenticated>
			<Unauthenticated>
				<div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-8">
					<div className="mb-8 text-center">
						<p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
							Speedcubing Ireland
						</p>
						<p className="mt-2 text-balance text-2xl font-semibold tracking-tight">
							Volunteer & Competition Dashboard
						</p>
						<p className="mt-2 text-sm text-muted-foreground">
							Sign in to access competitions, tasks, and activity insights.
						</p>
					</div>
					<SignInForm />
					<p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
						Speedcubing Ireland Volunteers sign in with Google. External
						Organisers sign in with WCA. Contact an admin if you need access.
					</p>
				</div>
			</Unauthenticated>
		</>
	);
}

function EnsureVolunteerAccess() {
	const ensureVolunteerAccess = useMutation(api.users.ensureVolunteerAccess);

	useEffect(() => {
		void ensureVolunteerAccess();
	}, [ensureVolunteerAccess]);

	return null;
}

function SignInForm() {
	const { signIn } = useAuthActions();
	return (
		<Card className="mx-auto w-full max-w-md">
			<CardHeader>
				<CardTitle>Sign in</CardTitle>
				<CardDescription>
					Choose the account type that applies to you.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<Button
					type="button"
					className="w-full"
					variant="outline"
					onClick={() => void signIn("google")}
				>
					Speedcubing Ireland Volunteer (GSuite)
				</Button>
				<Button
					type="button"
					className="w-full"
					variant="outline"
					onClick={() => void signIn("wca")}
				>
					External Organiser (WCA)
				</Button>
			</CardContent>
		</Card>
	);
}

export const Route = createRootRoute({ component: RootLayout });
