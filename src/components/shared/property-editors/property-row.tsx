"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

interface PropertyRowProps {
	label: string;
	children?: React.ReactNode;
	className?: string;
	icon?: React.ReactNode;
}

export function PropertyRow({
	label,
	children,
	className,
	icon,
}: PropertyRowProps) {
	return (
		<div
			className={cn(
				"flex min-h-9 items-center justify-between gap-3 px-3 -mx-3",
				className,
			)}
		>
			<div className="flex items-center gap-2 shrink-0">
				{icon && <span className="text-muted-foreground">{icon}</span>}
				<span className="text-sm text-muted-foreground">{label}</span>
			</div>
			<div className="flex items-center gap-2 min-w-0 justify-end flex-1">
				{children}
			</div>
		</div>
	);
}
