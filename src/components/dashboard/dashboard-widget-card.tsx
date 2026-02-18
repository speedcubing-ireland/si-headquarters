import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardWidgetCardProps {
	title: ReactNode;
	footerText?: string;
	footerTo?: string;
	children: ReactNode;
	className?: string;
}

export function DashboardWidgetCard({
	title,
	footerText,
	footerTo,
	children,
	className,
}: DashboardWidgetCardProps) {
	return (
		<Card className={cn("@container min-w-0 flex flex-col gap-1", className)}>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="flex min-w-0 flex-1 flex-col px-4 sm:px-6">
				{children}
				{footerText && footerTo && (
					<Link
						to={footerTo}
						className="mt-3 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						{footerText}
						<ArrowRight className="size-3" />
					</Link>
				)}
			</CardContent>
		</Card>
	);
}
