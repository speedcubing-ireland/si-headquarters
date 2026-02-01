"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { useDebouncedForm } from "@/hooks/use-debounced-form";

interface EditableTextProps {
	value: string;
	placeholder?: string;
	className?: string;
	displayClassName?: string;
	onSubmit: (next: string) => void;
	/** Debounce delay in milliseconds (default: 250ms) */
	debounceMs?: number;
}

/**
 * Editable text component with debounced updates.
 *
 * Uses local state for immediate typing feedback and debounces the onSubmit callback
 * to reduce unnecessary re-renders and store updates.
 *
 * @example
 * ```tsx
 * <EditableText
 *   value={competition.name}
 *   onSubmit={(next) => updateCompetition(id, { name: next })}
 *   debounceMs={250}
 * />
 * ```
 */
export function EditableText({
	value,
	placeholder,
	className,
	displayClassName,
	onSubmit,
	debounceMs = 250,
}: EditableTextProps) {
	const [isEditing, setIsEditing] = useState(false);

	const form = useDebouncedForm({
		initialValue: value,
		onChange: (nextValue) => {
			const trimmed = nextValue.trim();
			if (trimmed && trimmed !== value) {
				onSubmit(trimmed);
			}
		},
		debounceMs,
		immediateOnCommit: true,
	});

	const handleStartEditing = () => {
		form.reset();
		setIsEditing(true);
	};

	const handleCommit = () => {
		const trimmed = form.value.trim();
		if (!trimmed) {
			form.reset();
			setIsEditing(false);
			return;
		}
		form.commit();
		setIsEditing(false);
	};

	const handleCancel = () => {
		form.reset();
		setIsEditing(false);
	};

	if (isEditing) {
		return (
			<Input
				value={form.value}
				onChange={form.handleChange}
				onBlur={handleCommit}
				onKeyDown={(e) => {
					if (e.key === "Enter") handleCommit();
					if (e.key === "Escape") handleCancel();
				}}
				className={className}
				autoFocus
			/>
		);
	}

	return (
		<button
			type="button"
			className={displayClassName}
			onClick={handleStartEditing}
		>
			{value || placeholder}
		</button>
	);
}
