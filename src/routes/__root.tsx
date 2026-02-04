import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Layout } from "@/components/layout/layout";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";

const RootLayout = () => (
	<>
		<AuthLoading>
			<div className="flex min-h-svh items-center justify-center">
				<div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
			</div>
		</AuthLoading>
		<Authenticated>
			<Layout>
				<Outlet />
			</Layout>
		</Authenticated>
		<Unauthenticated>
			<SignInForm />
		</Unauthenticated>
	</>
);

function SignInForm() {
	const { signIn } = useAuthActions();
	return (
		<Card className="mx-auto w-full max-w-md">
			<CardHeader>
				<CardTitle>Sign in</CardTitle>
				<CardDescription>Log in to see the numbers</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<Button
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
