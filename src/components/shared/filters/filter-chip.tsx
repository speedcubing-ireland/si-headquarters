import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	ButtonGroup,
	ButtonGroupSeparator,
} from "@/components/ui/button-group";

type FilterChipProps<TValue extends string> = {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	values: TValue[];
	isNot: boolean;
	onToggleIsNot: () => void;
	onToggleValue: (value: TValue) => void;
	onRemove: () => void;
	renderValue: (value: TValue) => ReactNode;
	/**
	 * Optional wrapper for the "value" button (e.g. to attach a DropdownMenu trigger).
	 * This lets consumers make only the value segment open a multi-select menu,
	 * while keeping the rest of the chip buttons functional.
	 */
	wrapValueButton?: (button: React.ReactElement) => React.ReactNode;
};

/**
 * Shared filter chip used by table filter UIs (competitions, tasks, etc).
 *
 * Provides:
 * - Leading icon + label
 * - "is / is not / is any / is none" toggle
 * - Value selector via a child trigger
 * - Remove button
 */
export function SharedFilterChip<TValue extends string>({
	icon: Icon,
	label,
	values,
	isNot,
	onToggleIsNot,
	onToggleValue: _onToggleValue,
	onRemove,
	renderValue,
	wrapValueButton,
}: FilterChipProps<TValue>) {
	const hasMultiple = values.length > 1;
	const isNotText = hasMultiple
		? isNot
			? "is none"
			: "is any"
		: isNot
			? "is not"
			: "is";

	const valueButton = (
		<Button
			variant="outline"
			size="xs"
			className="min-w-0"
			onClick={() => {
				// For multi-select cases, consumers should wrap this button
				// with their own value selector trigger. For simple chips
				// we just render the current value(s).
			}}
		>
			{values.length === 1 ? (
				renderValue(values[0])
			) : (
				<span className="truncate">
					{values.length} {label.toLowerCase()}
				</span>
			)}
		</Button>
	);

	return (
		<ButtonGroup>
			<Button variant="outline" size="xs">
				<Icon className="size-4" />
				{label}
			</Button>
			<ButtonGroupSeparator orientation="vertical" />
			<Button variant="outline" size="xs" onClick={onToggleIsNot}>
				{isNotText}
			</Button>
			<ButtonGroupSeparator orientation="vertical" />
			{wrapValueButton ? wrapValueButton(valueButton) : valueButton}
			<ButtonGroupSeparator orientation="vertical" />
			<Button variant="outline" size="icon-xs" onClick={onRemove}>
				<X />
			</Button>
		</ButtonGroup>
	);
}
