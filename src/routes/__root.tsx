import { createRootRoute, Outlet } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
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
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";

const RootLayout = () => (
	<>
		<AuthLoading>
			<div className="flex min-h-svh items-center justify-center">
				<div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
			</div>
		</AuthLoading>
		<Authenticated>
			<EnsureVolunteerAccess />
			<ErrorBoundary>
				<NuqsAdapter>
					<Layout>
						<Outlet />
					</Layout>
				</NuqsAdapter>
			</ErrorBoundary>
		</Authenticated>
		<Unauthenticated>
			<div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-8">
				<div className="mb-8 text-center">
					<p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
						Speedcubing Ireland
					</p>
					<p className="mt-2 text-balance text-2xl font-semibold tracking-tight">
						Volunteer & competition dashboard
					</p>
					<p className="mt-2 text-sm text-muted-foreground">
						Sign in to access competitions, tasks, and activity insights.
					</p>
				</div>
				<SignInForm />
				<p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
					Use your Google account associated with Speedcubing Ireland. If you
					can&apos;t sign in, contact an admin to request access.
				</p>
			</div>
		</Unauthenticated>
	</>
);

/**
 * Component that ensures users with @speedcubingireland.com emails
 * are added to the Volunteer team on app initialization.
 * Idempotent - safe to call multiple times.
 */
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
					Continue with Google to access the dashboard.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<Button
					type="button"
					className="w-full"
					variant="outline"
					onClick={() => void signIn("google")}
				>
					Sign in with Google
				</Button>
			</CardContent>
		</Card>
	);
}

export const Route = createRootRoute({ component: RootLayout });
