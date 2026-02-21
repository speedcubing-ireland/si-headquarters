import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface TaskListGroupProps {
	title: ReactNode;
	countLabel?: string;
	headerMeta?: ReactNode;
	onToggle?: () => void;
	isCollapsed?: boolean;
	className?: string;
	children?: ReactNode;
}

export function TaskListGroup({
	title,
	countLabel,
	headerMeta,
	onToggle,
	isCollapsed = false,
	className,
	children,
}: TaskListGroupProps) {
	const titleRow = (
		<>
			<span className="text-sm font-medium">{title}</span>
			{countLabel ? (
				<Badge
					variant="outline"
					className="h-5 border-border bg-background text-xs font-normal"
				>
					{countLabel}
				</Badge>
			) : null}
		</>
	);

	return (
		<div
			className={cn(
				"min-w-0 space-y-2 rounded-lg border border-border bg-background/40 p-2.5 sm:p-3",
				className,
			)}
		>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				{onToggle ? (
					<button
						type="button"
						className="flex items-center gap-2 text-left"
						onClick={onToggle}
						aria-expanded={!isCollapsed}
					>
						{isCollapsed ? (
							<ChevronRight className="size-4 text-muted-foreground" />
						) : (
							<ChevronDown className="size-4 text-muted-foreground" />
						)}
						{titleRow}
					</button>
				) : (
					<div className="flex items-center gap-2">{titleRow}</div>
				)}
				{headerMeta}
			</div>

			{!isCollapsed && children ? (
				<>
					<Separator />
					{children}
				</>
			) : null}
		</div>
	);
}
