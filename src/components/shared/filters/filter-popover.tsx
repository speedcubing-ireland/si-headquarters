import type { LucideIcon } from "lucide-react";
import { ChevronDown, ListFilter } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SharedFilterPopoverTriggerProps = Omit<
	React.ComponentPropsWithoutRef<typeof Button>,
	"children"
> & {
	/**
	 * Number of active filters to display in the badge.
	 */
	count: number;
	/**
	 * Optional label text. Defaults to "Filter".
	 */
	label?: string;
	/**
	 * Optional custom icon. Defaults to the generic Filter icon.
	 */
	icon?: LucideIcon;
};

/**
 * Shared trigger button for filter popovers/menus used by tables.
 *
 * This keeps the filter control on competitions and tasks visually consistent
 * (icon, label, count badge, chevron, sizing).
 */
export const SharedFilterPopoverTrigger = React.forwardRef<
	React.ElementRef<typeof Button>,
	SharedFilterPopoverTriggerProps
>(({ count, label = "Filter", icon: Icon = ListFilter, className, ...props }, ref) => {
	return (
		<Button
			ref={ref}
			variant="outline"
			size="sm"
			type="button"
			className={cn("h-8 gap-1", className)}
			{...props}
		>
			<Icon className="size-4" />
			<span>{label}</span>
			{count > 0 && (
				<span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs">
					{count}
				</span>
			)}
			<ChevronDown className="size-4" />
		</Button>
	);
});
SharedFilterPopoverTrigger.displayName = "SharedFilterPopoverTrigger";
