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
				"flex min-h-9 min-w-0 items-start justify-between gap-3 px-3 -mx-3",
				className,
			)}
		>
			<div className="flex min-w-0 max-w-[45%] items-center gap-2">
				{icon && <span className="text-muted-foreground">{icon}</span>}
				<span className="min-w-0 truncate text-sm text-muted-foreground">
					{label}
				</span>
			</div>
			<div className="flex min-w-0 flex-1 items-start justify-end gap-2 text-right [&>*]:min-w-0 [&>*]:max-w-full [&>*]:whitespace-normal [&>*]:break-words">
				{children}
			</div>
		</div>
	);
}
