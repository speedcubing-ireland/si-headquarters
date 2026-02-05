import type { LucideIcon } from "lucide-react";
import { ChevronDown, ListFilter } from "lucide-react";
import React, {
	type ComponentPropsWithoutRef,
	type ReactNode,
	type Ref,
} from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type SharedFilterPopoverProps = {
	/** Current active filter count (shown on trigger). */
	count: number;
	/** Called when "Clear all filters" is clicked. */
	onClear: () => void;
	/** Submenus and any extra dropdown content (e.g. date presets). */
	children: ReactNode;
	/** Optional controlled open state. When provided, parent can close from children (e.g. on filter select). */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

/**
 * Shared filter dropdown shell: trigger, content area, and "Clear all filters".
 * Use for both tasks and competitions filter popovers.
 */
export function SharedFilterPopover({
	count,
	onClear,
	children,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
}: SharedFilterPopoverProps) {
	const [internalOpen, setInternalOpen] = React.useState(false);
	const open = controlledOpen ?? internalOpen;
	const setOpen = controlledOnOpenChange ?? setInternalOpen;

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<SharedFilterPopoverTrigger count={count} />
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-60" align="start">
				<DropdownMenuGroup>{children}</DropdownMenuGroup>
				{count > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={() => {
								onClear();
								setOpen(false);
							}}
						>
							Clear all filters
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
