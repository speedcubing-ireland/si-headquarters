import { X } from "lucide-react";
import React, { type ReactNode } from "react";
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
	wrapValueButton?: (button: React.ReactElement) => React.ReactNode;
};

export const SharedFilterChip = React.memo(function SharedFilterChip<
	TValue extends string,
>({
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
		<Button variant="outline" size="xs" className="min-w-0" onClick={() => {}}>
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
}) as <TValue extends string>(
	props: FilterChipProps<TValue>,
) => React.JSX.Element;
