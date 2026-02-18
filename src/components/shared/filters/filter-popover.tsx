import type { LucideIcon } from "lucide-react";
import { ChevronDown, ListFilter } from "lucide-react";
import React, {
	type ComponentPropsWithoutRef,
	type ReactNode,
	type Ref,
} from "react";
import { Badge } from "@/components/ui/badge";
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

const SharedFilterPopoverTrigger = React.memo(
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
				className={cn("h-9 gap-1 sm:h-8", className)}
				{...props}
			>
				<Icon className="size-4" />
				<span>{label}</span>
				{count > 0 ? (
					<Badge variant="default" className="ml-1 px-1.5 py-0 text-[10px]">
						{count}
					</Badge>
				) : null}
				<ChevronDown className="size-4" />
			</Button>
		);
	},
);

type SharedFilterPopoverProps = {
	count: number;

	onClear: () => void;

	children: ReactNode;

	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

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
			<DropdownMenuContent
				className="w-[min(15rem,calc(100vw-1rem))]"
				align="start"
			>
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
