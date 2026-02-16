import { Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

type PermissionGuardProps = {
	isLoading: boolean;
	canAccess: boolean;
	children: ReactNode;
	fallback?: ReactNode;
};

export function PermissionGuard({
	isLoading,
	canAccess,
	children,
	fallback,
}: PermissionGuardProps) {
	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!canAccess) {
		return fallback ?? <Navigate to="/" />;
	}

	return <>{children}</>;
}
