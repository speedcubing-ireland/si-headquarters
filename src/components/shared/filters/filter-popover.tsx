import type { LucideIcon } from "lucide-react";
import { ChevronDown, ListFilter } from "lucide-react";
import React, { type ComponentPropsWithoutRef, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SharedFilterPopoverTriggerProps = Omit<
	ComponentPropsWithoutRef<typeof Button>,
	"children"
> & {
	count: number;
	label?: string;
	icon?: LucideIcon;
	ref?: Ref<HTMLButtonElement>;
};

/**
 * Shared trigger button for filter popovers/menus used by tables.
 * React 19: ref is passed as a normal prop; no forwardRef.
 */
export const SharedFilterPopoverTrigger = React.memo(
	function SharedFilterPopoverTrigger({
		count,
		label = "Filter",
		icon: Icon = ListFilter,
		className,
		ref,
		...props
	}: SharedFilterPopoverTriggerProps) {
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
				{count > 0 ? (
					<span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs">
						{count}
					</span>
				) : null}
				<ChevronDown className="size-4" />
			</Button>
		);
	},
);
